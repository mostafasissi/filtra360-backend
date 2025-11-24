const UserProfile = require("../model/UserProfile");
const { TARGET_DNA_MARKERS } = require("../utils/constants");
const { OpenAI } = require("openai");

/**
 * DNA Service
 * Handles all DNA-related operations including file processing, data extraction, and storage
 */
class DNAService {
  
  /**
   * Add DNA data from AncestryDNA format file or text
   * @param {string} userId - User ID
   * @param {Object} data - DNA data containing fileBase64 or dnaText
   * @returns {Object} Result object with success status and data
   */
  static async addDnaData(userId, data) {
    try {
      console.log(`[DNAService.AddDnaData] Starting AncestryDNA data processing for userId: ${userId}`);
      const { fileBase64, dnaText } = data;

      if (!fileBase64 && !dnaText) {
        throw new Error("Either DNA file (base64) or DNA text data is required");
      }

      let extractedMarkers = [];
      let processingMethod = 'unknown';

      if (dnaText) {
        // Raw text data provided
        console.log('[DNAService.AddDnaData] Processing AncestryDNA text data');
        extractedMarkers = DNAService.extractDNAMarkers(dnaText);
        processingMethod = 'text_extraction';
      }
      else if (fileBase64) {
        // File upload - AncestryDNA format
        console.log('[DNAService.AddDnaData] Processing AncestryDNA file upload');
        const contentTypeMatch = fileBase64.match(/^data:(.*?);base64,/);
        if (!contentTypeMatch) {
          throw new Error("Invalid file format. Please upload a valid text file.");
        }

        const contentType = contentTypeMatch[1];
        const base64Data = fileBase64.split(',')[1];

        let extractedText = '';
        if (contentType === 'text/plain' || contentType === 'text/csv' || contentType.includes('text')) {
          const buffer = Buffer.from(base64Data, 'base64');
          extractedText = buffer.toString('utf-8');
          console.log(`[DNAService.AddDnaData] File decoded, text length: ${extractedText.length} characters`);
        } else {
          throw new Error("Only text files are supported for DNA data. Please upload a .txt file from AncestryDNA.");
        }

        // Validate that this looks like AncestryDNA format
        if (!extractedText.includes('rsid') || !extractedText.includes('chromosome') || !extractedText.includes('position')) {
          throw new Error("Invalid DNA file format. Expected AncestryDNA format with rsid, chromosome, position, allele1, allele2 columns.");
        }

        extractedMarkers = DNAService.extractDNAMarkers(extractedText);
        processingMethod = 'file_extraction';
      }

      if (extractedMarkers.length === 0) {
        throw new Error("No target DNA markers found in the provided data. Please ensure you've uploaded a valid AncestryDNA raw data file.");
      }

      console.log(`[DNAService.AddDnaData] Successfully extracted ${extractedMarkers.length} target DNA markers using ${processingMethod}`);

      // Prepare DNA data for existing schema
      const dnaData = {
        markers: extractedMarkers.map(marker => ({
          rs_number: marker.rsid,
          chromosome: marker.chromosome,
          position: marker.position,
          allele1: marker.allele1,
          allele2: marker.allele2
        })),
        metadata: {
          total_markers_found: extractedMarkers.length,
          last_updated: new Date()
        }
      };

      // Save to user profile using existing dna field
      const saveResult = await DNAService.saveDnaData(userId, dnaData);

      if (!saveResult.success) {
        throw new Error(saveResult.message || 'Failed to save DNA data');
      }

      console.log(`[DNAService.AddDnaData] ✅ DNA data saved successfully for user ${userId}`);

      return {
        success: true,
        message: 'DNA data processed and saved successfully',
        data: {
          markersProcessed: extractedMarkers.length,
          processingMethod: processingMethod,
          analysisDate: new Date().toISOString(),
          markers: extractedMarkers
        }
      };
    } catch (error) {
      console.error('[DNAService.AddDnaData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to process DNA data',
        error: error.message
      };
    }
  }

  /**
   * Get DNA data for a user
   * @param {string} userId - User ID
   * @returns {Object} Result object with DNA data
   */
  static async getDnaData(userId) {
    try {
      console.log(`[DNAService.GetDnaData] Retrieving DNA data for userId: ${userId}`);
      
      const profile = await UserProfile.findOne({ userId });
      if (!profile) {
        throw new Error('User profile not found');
      }

      if (!profile.dna || !profile.dna.markers || profile.dna.markers.length === 0) {
        return {
          success: true,
          message: 'No DNA data found for this user',
          data: {
            hasData: false,
            markers: [],
            metadata: null
          }
        };
      }

      console.log(`[DNAService.GetDnaData] Found ${profile.dna.markers.length} DNA markers`);

      return {
        success: true,
        message: 'DNA data retrieved successfully',
        data: {
          hasData: true,
          markers: profile.dna.markers,
          metadata: profile.dna.metadata,
          totalMarkers: profile.dna.markers.length,
          lastUpdated: profile.dna.metadata?.last_updated || null
        }
      };
    } catch (error) {
      console.error('[DNAService.GetDnaData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to retrieve DNA data',
        error: error.message
      };
    }
  }

  /**
   * Analyze user's DNA data using AI
   * @param {string} userId - User ID
   * @returns {Object} Analysis result with traits and recommendations
   */
  static async analyzeUserDna(userId) {
    try {
      console.log(`[DNAService.analyzeUserDna] Starting analysis for userId: ${userId}`);
      
      // Get DNA data
      const dnaDataResult = await DNAService.getDnaData(userId);
      if (!dnaDataResult.success || !dnaDataResult.data.hasData) {
        throw new Error('No DNA data found for this user. Please upload DNA data first.');
      }

      // Get user context
      const userContext = await DNAService._getUserContext(userId);
      if (!userContext.success) {
        throw new Error(userContext.message || 'Failed to get user context');
      }

      // Prepare data for AI analysis
      const analysisData = DNAService._prepareAnalysisData(
        dnaDataResult.data.markers,
        userContext.data
      );

      // Perform AI analysis
      const aiResult = await DNAService._performAIAnalysis(analysisData);
      if (!aiResult.success) {
        throw new Error(aiResult.message || 'AI analysis failed');
      }

      // Validate and structure the result
      const structuredResult = DNAService._structureAnalysisResult(
        aiResult.data,
        dnaDataResult.data.markers.length,
        userId
      );

      console.log(`[DNAService.analyzeUserDna] Analysis completed successfully`);
      return {
        success: true,
        message: 'DNA analysis completed successfully',
        data: structuredResult
      };

    } catch (error) {
      console.error('[DNAService.analyzeUserDna] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze DNA',
        error: {
          type: error.name || 'DNAAnalysisError',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
    }
  }

  /**
   * Get user context for DNA analysis
   * @private
   * @param {string} userId - User ID
   * @returns {Object} User context data
   */
  static async _getUserContext(userId) {
    try {
      const User = require('../model/Users');
      
      const [user, profile] = await Promise.all([
        User.findById(userId),
        UserProfile.findOne({ userId })
      ]);

      if (!user) {
        throw new Error('User not found');
      }
      if (!profile) {
        throw new Error('User profile not found');
      }

      const age = profile.dateOfBirth 
        ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
        : null;

      return {
        success: true,
        data: {
          userId,
          userName: user.fullName || 'User',
          age,
          gender: profile.sexAtBirth || 'Unknown',
          goals: profile.goals || [],
          dietType: profile.dietType || 'standard',
          exerciseLevel: profile.exerciseLevel || 'Unknown',
          sleepQuality: profile.sleepQuality || 'Unknown',
          healthConcerns: profile.healthConcerns || []
        }
      };
    } catch (error) {
      console.error('[DNAService._getUserContext] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to get user context'
      };
    }
  }

  /**
   * Prepare data for AI analysis
   * @private
   * @param {Array} dnaMarkers - DNA markers array
   * @param {Object} userContext - User context data (ignored by new prompt)
   * @returns {Object} Prepared analysis data
   */
  static _prepareAnalysisData(dnaMarkers, userContext) {
    // Convert DNA markers to simplified format for AI
    const snps = dnaMarkers.map(marker => ({
      rsid: marker.rs_number,
      a1: marker.allele1,
      a2: marker.allele2
    }));

    // Create system prompt with genetic interpretation rules
    const systemPrompt = DNAService._buildSystemPrompt(snps);
    
    // No user prompt needed - new system prompt ignores non-DNA fields

    return {
      systemPrompt,
      markersCount: dnaMarkers.length
    };
  }

  /**
   * Build system prompt for AI analysis
   * @private
   * @param {Array} snps - Simplified SNP data
   * @returns {string} System prompt
   */
  static _buildSystemPrompt(snps) {
    return `Return ONLY JSON. No prose outside JSON.

STRICT DNA-ONLY MODE
- Use ONLY the rsIDs and alleles provided in DNA.
- If any non-DNA fields (name, age, goals, diet, lifestyle, labs, etc.) are present, IGNORE them entirely.

DNA Data: ${JSON.stringify(snps)}

OUTPUT SCHEMA (MUST MATCH EXACTLY — no other keys allowed):
{
  "report_title": "string",
  "traits": [
    {
      "title": "string",
      "Why it matters": "string",
      "SNP role": "string",
      "Result": "string",
      "Impact": "string",
      "Action": ["string"]
    }
  ]
}

GENOTYPE RULES
- Build genotype for each rsID by combining allele1+allele2, order-agnostic, uppercase (A/C == C/A -> "AC").
- If an rsID is missing from DNA, genotype = "not available".

TITLE FORMAT
- For each trait: "N. {Trait Name} ({GENES} {RSIDs with genotypes})"
- If multiple rsIDs, include each as "GENE rsID = GT" separated by comma.
- If an rsID is missing, show "rsID = not available".

TRAIT CATALOG (RETURN IN THIS ORDER — DO NOT RETURN ANY OTHER TRAITS)
1) Lactose Intolerance
   genes: LCT
   rsids: rs4988235
   why: "Lactase is the enzyme that digests milk sugar (lactose). After childhood, most people lose it."
   role: "LCT gene variant (rs4988235) controls lactase persistence."
   rules: rs4988235 CC = lactose intolerant (non-persistent); CT or TT = lactase persistent (tolerant).
   actions_if_risk: ["Avoid milk, cream, and ice cream.", "Safer: butter, hard cheeses, kefir, lactose-free milk."]

2) Gluten / Celiac Predisposition
   genes: HLA-DQ
   rsids: HLA-DQA1/HLA-DQB1 (DQ2/DQ8)
   why: "Gluten sensitivity and celiac disease are linked to certain HLA immune genes."
   role: "HLA-DQ2/DQ8 determine celiac risk."
   missing_behavior: Result="Not available in Ancestry data.", Impact="Cannot be determined from this dataset.", Action=["If symptoms exist (bloating, fatigue, autoimmune issues), trial gluten elimination and confirm with blood tests if needed."]

3) Alcohol Flush
   genes: ALDH2, ADH1B
   rsids: rs671, rs1229984
   why: "ALDH2 and ADH1B enzymes clear acetaldehyde, a toxic alcohol byproduct."
   role: "Slow ALDH2 causes flushing, headaches, and higher cancer risk."
   rules:
     - rs671: any A allele -> ALDH2 slow (flush risk); GG -> normal
     - rs1229984: A allele -> faster ADH1B (more acetaldehyde); TT -> typical
   actions_if_normal: ["Avoiding alcohol is still best for detox, thyroid, and overall health."]
   actions_if_risk: ["Limit or avoid alcohol; choose lower-alcohol options if drinking."]

4) Caffeine Metabolism
   genes: CYP1A2
   rsids: rs762551
   why: "Caffeine is broken down by CYP1A2 in the liver."
   role: "Determines whether caffeine clears fast or slow."
   rules: AA = fast; AC = intermediate; CC = slow.
   actions_if_fast: ["Coffee and tea are tolerated, especially in the morning.", "Still avoid caffeine late in the day to protect sleep."]
   actions_if_intermediate: ["Limit caffeine to moderate amounts and avoid late-day intake."]
   actions_if_slow: ["Lower caffeine intake; avoid afternoon/evening caffeine."]

5) Taste Perception (Bitter/Sweet)
   genes: TAS2R38, TAS1R2
   rsids: rs713598, rs1726866, rs10246939, rs35874116
   why: "TAS2R38 influences bitter taste perception (vegetables like broccoli, kale). TAS1R2 influences sweet preference."
   role: "Determines sensitivity to bitter/sweet flavors."
   missing_behavior: Result="Not available in Ancestry data.", Impact="Cannot determine bitter/sweet sensitivity from this dataset.", Action=["Go by taste preference. If crucifer vegetables are difficult, use other antioxidant-rich foods or supplements (e.g., sulforaphane)."]

6) Histamine Intolerance (DAO / AOC1)
   genes: AOC1
   rsids: rs10156191
   why: "DAO enzyme breaks down histamine from food (wine, vinegar, aged cheese)."
   role: "Reduced DAO activity → histamine buildup."
   rules: any T allele (CT or TT) = higher histamine sensitivity; CC = typical.
   actions_if_T_present: ["Reduce aged/fermented foods (wine, vinegar, aged cheese, smoked meats) if symptoms appear.", "Support DAO with vitamin C, magnesium, and fresh foods."]

ALGORITHM (PER TRAIT)
1) Build genotype(s) for listed rsIDs (or "not available").
2) Determine Result and Impact using 'rules' or 'missing_behavior'.
3) Choose Action list accordingly (use exact bullets defined above).
4) Emit EXACTLY these keys and order for each trait: "title", "Why it matters", "SNP role", "Result", "Impact", "Action".
5) Set "report_title" = "DNA — Digestive Sensitivities & Metabolism".
6) NEVER output keys like whyItMatters/snpRole/snpsUsed/status/evidence/summary. ONLY the schema above.`;
  }

  /**
   * Build user prompt with context
   * @private
   * @param {Object} userContext - User context data
   * @returns {string} User prompt
   */
  static _buildUserPrompt(userContext) {
    return `${userContext.userName}, ${userContext.age}yo, goals: ${userContext.goals.join(',') || 'wellness'}. Analyze DNA, be concise.`;
  }

  /**
   * Perform AI analysis using OpenAI
   * @private
   * @param {Object} analysisData - Analysis data with prompts
   * @returns {Object} AI analysis result
   */
  static async _performAIAnalysis(analysisData) {
    try {
      // Initialize OpenAI
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not set. Please set OPENAI_API_KEY in environment variables.');
      }
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      console.log('[DNAService._performAIAnalysis] Sending request to OpenAI...');
      console.log(`[DNAService._performAIAnalysis] Analyzing ${analysisData.markersCount} DNA markers`);
      
      // Log the complete prompt being sent
      console.log('==================+PROMPT+======================');
      console.log(analysisData.systemPrompt);
      console.log('================================================');

      const completion = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: analysisData.systemPrompt }
        ],
        max_completion_tokens: 6000, // Optimized for new prompt format
        response_format: { type: 'json_object' }
      });

      console.log('[DNAService._performAIAnalysis] OpenAI response received:', {
        id: completion.id,
        model: completion.model,
        finish_reason: completion.choices[0].finish_reason,
        usage: completion.usage
      });

      // Check for truncation
      if (completion.choices[0].finish_reason === 'length') {
        throw new Error('AI response was truncated due to token limit. Try reducing analysis complexity.');
      }

      const responseContent = completion.choices[0].message.content;
      
      let result;
      try {
        result = JSON.parse(responseContent);
      } catch (parseError) {
        console.error('[DNAService._performAIAnalysis] JSON parse error:', parseError);
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('[DNAService._performAIAnalysis] Error:', error);
      return {
        success: false,
        message: error.message || 'AI analysis failed'
      };
    }
  }

  /**
   * Structure the analysis result
   * @private
   * @param {Object} aiResult - Raw AI result
   * @param {number} totalMarkers - Total markers analyzed
   * @param {string} userId - User ID
   * @returns {Object} Structured result
   */
  static _structureAnalysisResult(aiResult, totalMarkers, userId) {
    // Map AI result fields to expected format
    const traits = Array.isArray(aiResult.traits) ? aiResult.traits.map(trait => ({
      title: trait.title || 'Unknown Trait',
      whyItMatters: trait['Why it matters'] || 'Health significance not specified',
      snpRole: trait['SNP role'] || 'Genetic mechanism not specified',
      result: trait.Result || 'Result not specified',
      impact: trait.Impact || 'Impact not specified',
      action: Array.isArray(trait.Action) ? trait.Action : ['No actions specified'],
      // Keep these for compatibility but they won't be populated by new format
      snpsUsed: [],
      missingSnps: [],
      resultText: trait.Result || 'No detailed interpretation available',
      status: 'analyzed',
      evidence: 'genetic'
    })) : [];

    const result = {
      analysis: {
        title: aiResult.report_title || 'DNA Analysis',
        traits: traits,
        summary: ['DNA analysis completed with genetic trait evaluation.']
      },
      metadata: {
        analyzedAt: new Date(),
        totalMarkersAnalyzed: totalMarkers,
        traitsFound: traits.length,
        userId: userId
      }
    };

    return result;
  }

  /**
   * Update DNA data - replace existing DNA data with new AncestryDNA file
   * @param {string} userId - User ID
   * @param {Object} data - DNA data containing fileBase64 or dnaText
   * @returns {Object} Result object with update status
   */
  static async updateDnaData(userId, data) {
    try {
      console.log(`[DNAService.UpdateDnaData] Updating AncestryDNA data for userId: ${userId}`);
      const { fileBase64, dnaText } = data;

      if (!fileBase64 && !dnaText) {
        throw new Error('Either DNA file (base64) or DNA text data is required');
      }

      const profile = await UserProfile.findOne({ userId });
      if (!profile) {
        throw new Error('User profile not found');
      }

      // Process the new DNA data using the same logic as addDnaData
      let extractedMarkers = [];
      let processingMethod = 'unknown';

      if (dnaText) {
        console.log('[DNAService.UpdateDnaData] Processing new AncestryDNA text data');
        extractedMarkers = DNAService.extractDNAMarkers(dnaText);
        processingMethod = 'text_extraction';
      }
      else if (fileBase64) {
        console.log('[DNAService.UpdateDnaData] Processing new AncestryDNA file upload');
        const contentTypeMatch = fileBase64.match(/^data:(.*?);base64,/);
        if (!contentTypeMatch) {
          throw new Error("Invalid file format. Please upload a valid text file.");
        }

        const contentType = contentTypeMatch[1];
        const base64Data = fileBase64.split(',')[1];

        let extractedText = '';
        if (contentType === 'text/plain' || contentType === 'text/csv' || contentType.includes('text')) {
          const buffer = Buffer.from(base64Data, 'base64');
          extractedText = buffer.toString('utf-8');
        } else {
          throw new Error("Only text files are supported for DNA data. Please upload a .txt file from AncestryDNA.");
        }

        // Validate format
        if (!extractedText.includes('rsid') || !extractedText.includes('chromosome') || !extractedText.includes('position')) {
          throw new Error("Invalid DNA file format. Expected AncestryDNA format with rsid, chromosome, position, allele1, allele2 columns.");
        }

        extractedMarkers = DNAService.extractDNAMarkers(extractedText);
        processingMethod = 'file_extraction';
      }

      if (extractedMarkers.length === 0) {
        throw new Error("No target DNA markers found in the provided data. Please ensure you've uploaded a valid AncestryDNA raw data file.");
      }

      // Replace all existing markers with new ones
      const updatedMarkers = extractedMarkers.map(marker => ({
        rs_number: marker.rsid,
        chromosome: marker.chromosome,
        position: marker.position,
        allele1: marker.allele1,
        allele2: marker.allele2
      }));

      // Update the profile
      const updateResult = await UserProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            'dna.markers': updatedMarkers,
            'dna.metadata': {
              total_markers_found: updatedMarkers.length,
              last_updated: new Date()
            },
            isUpdated: true, // Mark profile as updated
            'personalizedPlan.isAlreadyAnalyzed': false // Reset analysis flag due to DNA update
          }
        },
        { new: true, runValidators: true }
      );

      if (!updateResult) {
        throw new Error('Failed to update DNA data');
      }

      console.log(`[DNAService.UpdateDnaData] ✅ Updated with ${updatedMarkers.length} DNA markers`);

      return {
        success: true,
        message: 'DNA data updated successfully',
        data: {
          markersUpdated: updatedMarkers.length,
          totalMarkers: updatedMarkers.length,
          processingMethod: processingMethod,
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      console.error('[DNAService.UpdateDnaData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to update DNA data',
        error: error.message
      };
    }
  }

  /**
   * Delete DNA data for a user
   * @param {string} userId - User ID
   * @returns {Object} Result object with deletion status
   */
  static async deleteDnaData(userId) {
    try {
      console.log(`[DNAService.DeleteDnaData] Deleting DNA data for userId: ${userId}`);
      
      const updateResult = await UserProfile.findOneAndUpdate(
        { userId },
        {
          $unset: { dna: 1 },
          $set: { 
            isUpdated: true,
            'personalizedPlan.isAlreadyAnalyzed': false // Reset analysis flag due to DNA deletion
          }
        },
        { new: true, runValidators: true }
      );

      if (!updateResult) {
        throw new Error('User profile not found');
      }

      console.log(`[DNAService.DeleteDnaData] ✅ DNA data deleted successfully`);

      return {
        success: true,
        message: 'DNA data deleted successfully'
      };
    } catch (error) {
      console.error('[DNAService.DeleteDnaData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete DNA data',
        error: error.message
      };
    }
  }

  /**
   * Save DNA data to user profile using existing dna field schema
   * @param {string} userId - User ID
   * @param {Object} dnaData - DNA data with markers and metadata
   * @returns {Object} Result object with save status
   */
  static async saveDnaData(userId, dnaData) {
    try {
      console.log(`[DNAService.SaveDnaData] Starting saveDnaData for userId: ${userId}`);
      console.log(`[DNAService.SaveDnaData] DNA data received:`, JSON.stringify(dnaData, null, 2));

      // First, check if user profile exists
      console.log('Checking for existing user profile...');
      let userProfile = await UserProfile.findOne({ userId });
      console.log('Existing profile found:', userProfile ? 'Yes' : 'No');

      if (!userProfile) {
        console.log('Creating new user profile...');
        // Create new user profile if it doesn't exist
        userProfile = new UserProfile({
          userId,
          dna: dnaData
        });
        console.log('New profile object created');
        await userProfile.save();
        console.log('New profile saved successfully');
      } else {
        console.log('Updating existing profile...');
        
        // Update the profile with new DNA data
        userProfile = await UserProfile.findOneAndUpdate(
          { userId },
          { $set: { dna: dnaData } },
          { new: true, runValidators: true, upsert: false }
        );
        console.log('DNA data updated successfully');
      }

      if (!userProfile) {
        console.error('Failed to create or update user profile');
        throw new Error('Failed to create or update user profile');
      }

      // Set isUpdated to true since we've modified the profile with new DNA data
      console.log(`[DNAService.SaveDnaData] Setting isUpdated = true after saving DNA data`);
      console.log(`[DNAService.SaveDnaData] Previous isUpdated value: ${userProfile.isUpdated}`);
      
      userProfile.isUpdated = true;
      
      // Reset personalized plan analysis flag since DNA data has changed
      if (userProfile.personalizedPlan && userProfile.personalizedPlan.isAlreadyAnalyzed) {
        console.log(`[DNAService.SaveDnaData] Resetting personalizedPlan.isAlreadyAnalyzed to false due to DNA data change`);
        userProfile.personalizedPlan.isAlreadyAnalyzed = false;
      }
      
      await userProfile.save();
      
      console.log(`[DNAService.SaveDnaData] New isUpdated value: ${userProfile.isUpdated}`);
      console.log(`[DNAService.SaveDnaData] ✅ DNA data saved successfully and profile marked as updated`);

      return {
        success: true,
        message: 'DNA data saved successfully',
        data: userProfile
      };
    } catch (error) {
      console.error('Error in DNAService.saveDnaData:', error);
      return {
        success: false,
        message: error.message || 'Failed to save DNA data'
      };
    }
  }

  /**
   * Extract DNA markers from AncestryDNA text format
   * @param {string} text - Raw DNA text data
   * @returns {Array} Array of extracted DNA markers
   */
  static extractDNAMarkers(text) {
    const startTime = Date.now();
    console.log('🧬 Starting DNA marker extraction...');
    console.log(`📝 Input text length: ${text.length} characters`);
    
    // Target DNA markers we're looking for
    const targetMarkers = TARGET_DNA_MARKERS;
    console.log(`🎯 Looking for ${targetMarkers.length} target markers`);

    const extractedMarkers = [];
    const lines = text.split('\n');
    let dataLines = 0;
    let invalidLines = 0;
    
    console.log(`📄 Total lines to process: ${lines.length}`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines && comments && headers
      if (!line || line.length === 0 || line.startsWith('#') || 
          (line.toLowerCase().includes('rsid') && line.toLowerCase().includes('chromosome'))) {
        continue;
      }
      
      // Parse data line - handle both tab and space delimited
      let parts;
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else {
        parts = line.split(/\s+/);
      }
      
      if (parts.length >= 4) {
        dataLines++;
        const rsid = parts[0].trim();
        const chromosome = parts[1].trim();
        const position = parts[2].trim();
        
        // Handle different genotype formats (AncestryDNA has allele1 and allele2 in separate columns)
        let allele1, allele2;
        if (parts.length >= 5) {
          // AncestryDNA format: rsid, chromosome, position, allele1, allele2
          allele1 = parts[3].trim();
          allele2 = parts[4].trim();
        } else {
          // Single genotype column format
          const genotype = parts[3].trim();
          if (genotype.includes('/')) {
            [allele1, allele2] = genotype.split('/');
          } else if (genotype.length === 2) {
            allele1 = genotype[0];
            allele2 = genotype[1];
          } else {
            allele1 = genotype;
            allele2 = genotype;
          }
        }
        
        // Check if this marker is in our target list
        if (targetMarkers.includes(rsid)) {
          console.log(`🎯 Found target marker: ${rsid} - ${allele1}/${allele2}`);
          extractedMarkers.push({
            rsid,
            chromosome,
            position,
            allele1: allele1.trim(),
            allele2: allele2.trim()
          });
        }
      } else {
        invalidLines++;
      }
    }
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log('\n🎯 === DNA EXTRACTION SUMMARY ===');
    console.log(`⏱️  Processing time: ${processingTime}ms`);
    console.log(`📄 Total lines: ${lines.length}`);
    console.log(`📊 Data lines: ${dataLines}`);
    console.log(`❌ Invalid lines: ${invalidLines}`);
    console.log(`✅ Target markers found: ${extractedMarkers.length}/${targetMarkers.length} (${((extractedMarkers.length/targetMarkers.length)*100).toFixed(1)}%)`);
    console.log(`🏁 Extraction complete!\n`);
    return extractedMarkers;
  }

  /**
   * Validate AncestryDNA file format
   * @param {string} text - File content to validate
   * @returns {Object} Validation result with isValid and message
   */
  static validateAncestryDNAFormat(text) {
    try {
      // Check for AncestryDNA headers
      const hasAncestryHeader = text.includes('#AncestryDNA raw data download') || 
                               text.includes('AncestryDNA') ||
                               text.includes('ancestry.com');
      
      // Check for required columns
      const hasRequiredColumns = text.includes('rsid') && 
                                 text.includes('chromosome') && 
                                 text.includes('position');
      
      // Check for allele columns (AncestryDNA specific)
      const hasAlleleColumns = text.includes('allele1') && text.includes('allele2');
      
      // Count data lines
      const lines = text.split('\n');
      let dataLines = 0;
      for (const line of lines) {
        if (line.trim() && !line.startsWith('#') && 
            !line.toLowerCase().includes('rsid')) {
          const parts = line.split('\t');
          if (parts.length >= 4) {
            dataLines++;
          }
        }
      }
      
      if (!hasRequiredColumns) {
        return {
          isValid: false,
          message: 'Invalid file format. Missing required columns (rsid, chromosome, position).'
        };
      }
      
      if (dataLines === 0) {
        return {
          isValid: false,
          message: 'No valid data lines found in the file.'
        };
      }
      
      return {
        isValid: true,
        message: `Valid AncestryDNA format detected. Found ${dataLines} data lines.`,
        metadata: {
          hasAncestryHeader,
          hasAlleleColumns,
          dataLines,
          totalLines: lines.length
        }
      };
    } catch (error) {
      return {
        isValid: false,
        message: `Error validating file format: ${error.message}`
      };
    }
  }

  /**
   * Get DNA statistics for a user
   * @param {string} userId - User ID
   * @returns {Object} DNA statistics including marker counts by category
   */
  static async getDnaStatistics(userId) {
    try {
      console.log(`[DNAService.GetDnaStatistics] Getting DNA statistics for userId: ${userId}`);
      
      const profile = await UserProfile.findOne({ userId });
      if (!profile || !profile.dna || !profile.dna.markers) {
        return {
          success: true,
          message: 'No DNA data found for statistics',
          data: {
            totalMarkers: 0,
            categorizedMarkers: {},
            uploadDate: null,
            lastUpdated: null
          }
        };
      }

      const markers = profile.dna.markers;
      
      // Since the existing schema doesn't have categories, we'll group by chromosome
      const categorizedMarkers = {};
      markers.forEach(marker => {
        const category = `Chromosome ${marker.chromosome}` || 'Unknown';
        if (!categorizedMarkers[category]) {
          categorizedMarkers[category] = 0;
        }
        categorizedMarkers[category]++;
      });

      return {
        success: true,
        message: 'DNA statistics retrieved successfully',
        data: {
          totalMarkers: markers.length,
          categorizedMarkers,
          uploadDate: null, // Not available in existing schema
          lastUpdated: profile.dna.metadata?.last_updated || null,
          processingMethod: 'ancestry_dna', // Default for existing schema
          reportType: 'raw_markers' // Default for existing schema
        }
      };
    } catch (error) {
      console.error('[DNAService.GetDnaStatistics] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to get DNA statistics',
        error: error.message
      };
    }
  }
}

module.exports = DNAService;