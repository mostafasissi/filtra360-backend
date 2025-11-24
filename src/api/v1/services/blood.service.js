const UserProfile = require("../model/UserProfile");
const { BLOOD_PROMPT } = require("../utils/constants");
const { OpenAI } = require("openai");
const { extractTextFromBase64 } = require("../helper/extractTextFromBase64");

/**
 * Blood Work Service
 * Handles all blood work-related operations including file processing, data extraction, and storage
 */
class BloodService {
  /**
   * Get blood work data for a user
   * @param {string} userId - User ID
   * @returns {Object} Result object with blood work data
   */
  static async getBloodData(userId) {
    try {
      console.log(`[BloodService.GetBloodData] Retrieving blood work data for userId: ${userId}`);
      
      const profile = await UserProfile.findOne({ userId });
      if (!profile) {
        throw new Error('User profile not found');
      }

      if (!profile.bloodReport || !profile.bloodReport.analysis) {
        return {
          success: true,
          message: 'No blood work data found for this user',
          data: {
            hasData: false,
            extracted_text: null,
            analysis: null,
            metadata: null
          }
        };
      }

      console.log(`[BloodService.GetBloodData] Found blood work data`);

      const responseData = {
        hasData: true,
        extracted_text: profile.bloodReport.extracted_text,
        analysis: profile.bloodReport.analysis,
        metadata: profile.bloodReport.metadata,
        lastUpdated: profile.bloodReport.metadata?.last_updated || null
      };

      return {
        success: true,
        message: 'Blood work data retrieved successfully',
        data: responseData
      };
    } catch (error) {
      console.error('[BloodService.GetBloodData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to retrieve blood work data',
        error: error.message
      };
    }
  }


 /**
   * Save blood work data to user profile
   * Saves data in the simplified format: { extracted_text, analysis, metadata }
   * @param {string} userId - User ID
   * @param {Object} bloodData - Blood work data from analyzeBloodWork response
   * @returns {Object} Result object
   */
  static async saveBloodData(userId, bloodData) {
    try {
      console.log(`[BloodService.saveBloodData] Saving blood work data for userId: ${userId}`);
      
      let profile = await UserProfile.findOne({ userId });
      if (!profile) {
        throw new Error('User profile not found');
      }

      // Log the structure we received for debugging
      console.log('[BloodService.saveBloodData] Input data structure:', {
        hasExtractedText: !!bloodData.extracted_text,
        hasAnalysis: !!bloodData.analysis,
        hasProcessingInfo: !!bloodData.processing_info,
        analysisTitle: bloodData.analysis?.title,
        categoriesCount: bloodData.analysis?.categories?.length || 0,
        textLength: bloodData.extracted_text?.length || 0
      });

      // Validate required structure
      if (!bloodData.analysis || !bloodData.analysis.title || !bloodData.analysis.categories) {
        throw new Error('Invalid blood data structure: missing analysis, title, or categories');
      }

      const analysisData = bloodData.analysis;
      console.log(`[BloodService.saveBloodData] Processing structure with ${analysisData.categories.length} categories`);

      // Extract lab name from the extracted text if available
      const labName = this.extractLabName(extractedText);

      // Count total markers across all categories
      let totalMarkers = 0;
      analysisData.categories.forEach(category => {
        totalMarkers += category.markers?.length || 0;
      });

      // Create the structured blood data for database storage - according to schema
      const structuredBloodData = {
        // Store the complete analysis with proper structure
        analysis: {
          title: analysisData.title,
          dateAnalyzed: analysisData.dateAnalyzed,
          summary: analysisData.summary,
          categories: analysisData.categories.map(category => ({
            name: category.name,
            markers: category.markers?.map(marker => ({
              marker: marker.marker || marker.name,
              value: marker.value,
              unit: marker.unit,
              optimalRange: marker.optimalRange || marker.optimal_range,
              clinicalRange: marker.clinicalRange || marker.clinical_range
            })) || [],
            summary: category.summary,
            insight: category.insight
          }))
        },
        
        // Metadata according to schema
        metadata: {
          total_tests: totalMarkers,
          report_date: analysisData.dateAnalyzed || new Date().toISOString(),
          lab_name: labName || 'Unknown Lab',
          last_updated: new Date()
        }
      };

      // Save to database
      profile.bloodReport = structuredBloodData;
      
      // Reset personalized plan analysis flag since blood data has changed
      if (profile.personalizedPlan && profile.personalizedPlan.isAlreadyAnalyzed) {
        console.log(`[BloodService.saveBloodData] Resetting personalizedPlan.isAlreadyAnalyzed to false due to blood data change`);
        profile.personalizedPlan.isAlreadyAnalyzed = false;
      }
      
      await profile.save();

      console.log(`[BloodService.saveBloodData] ✅ Blood work data saved successfully`);

      return {
        success: true,
        message: 'Blood work data saved successfully',
        data: {
          total_markers: totalMarkers,
          total_categories: analysisData.categories.length,
          date_analyzed: analysisData.dateAnalyzed,
          lab_name: labName,
          categories: analysisData.categories.map(cat => ({
            name: cat.name,
            marker_count: cat.markers?.length || 0
          }))
        }
      };
    } catch (error) {
      console.error('[BloodService.saveBloodData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to save blood work data',
        error: error.message
      };
    }
  }

  /**
   * Helper method to extract lab name from lab report text
   * @private
   * @param {string} text - Extracted text from lab report
   * @returns {string|null} Lab name if found
   */
  static extractLabName(text) {
    try {
      // Look for common lab names or patterns
      const labPatterns = [
        /Laboratory Corporation of America/i,
        /LabCorp/i,
        /Quest Diagnostics/i,
        /Lab:\s*([A-Za-z\s]+?)(?:\n|Date|Phone)/i,
        /Performing Labs[^:]*:\s*([A-Za-z\s-]+)/i
      ];
      
      for (const pattern of labPatterns) {
        const match = text.match(pattern);
        if (match) {
          return match[1] ? match[1].trim() : match[0].trim();
        }
      }
      return null;
    } catch (error) {
      console.warn('[BloodService.extractLabName] Error extracting lab name:', error.message);
      return null;
    }
  }

  /**
   * Add blood work data for a user
   * @param {string} userId - User ID
   * @param {Object} bloodData - Blood work data to add
   * @returns {Object} Result object
   */
  static async addBloodData(userId, bloodData) {
    try {
      console.log(`[BloodService.addBloodData] Adding blood work data for userId: ${userId}`);
      
      // For now, this is the same as saving blood data
      // In the future, this could handle different input formats
      return await BloodService.saveBloodData(userId, bloodData);
    } catch (error) {
      console.error('[BloodService.addBloodData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to add blood work data',
        error: error.message
      };
    }
  }

  /**
   * Update blood work data for a user
   * @param {string} userId - User ID
   * @param {Object} bloodData - Updated blood work data
   * @returns {Object} Result object
   */
  static async updateBloodData(userId, bloodData) {
    try {
      console.log(`[BloodService.updateBloodData] Updating blood work data for userId: ${userId}`);
      
      // Check if user has existing data
      const existingData = await BloodService.getBloodData(userId);
      if (!existingData.success || !existingData.data.hasData) {
        return {
          success: false,
          message: 'No existing blood work data found to update. Please add data first.',
          error: 'No existing data'
        };
      }

      // Update the data (same as save for now)
      return await BloodService.saveBloodData(userId, bloodData);
    } catch (error) {
      console.error('[BloodService.updateBloodData] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to update blood work data',
        error: error.message
      };
    }
  }



  /**
   * Get blood work statistics
   * @param {string} userId - User ID
   * @returns {Object} Statistics about blood work data
   */
  static async getBloodWorkStatistics(userId) {
    try {
      console.log(`[BloodService.getBloodWorkStatistics] Getting statistics for userId: ${userId}`);
      
      const bloodData = await BloodService.getBloodData(userId);
      if (!bloodData.success || !bloodData.data.hasData) {
        return {
          success: true,
          message: 'No blood work data available for statistics',
          data: {
            hasData: false,
            totalTests: 0,
            categories: {},
            lastUpdate: null
          }
        };
      }

      const analysis = bloodData.data.analysis;
      const metadata = bloodData.data.metadata;

      // Calculate statistics from the analysis categories
      const categoryStats = {};
      let totalMarkers = 0;
      
      analysis.categories?.forEach(category => {
        const categoryName = category.name.toLowerCase().replace(/\s+/g, '_');
        categoryStats[categoryName] = category.markers?.length || 0;
        totalMarkers += category.markers?.length || 0;
      });

      const statistics = {
        hasData: true,
        totalTests: totalMarkers,
        totalCategories: analysis.categories?.length || 0,
        categories: categoryStats,
        analysis_categories: analysis.categories?.map(cat => ({
          name: cat.name,
          markerCount: cat.markers?.length || 0,
          summary: cat.summary,
          insight: cat.insight
        })) || [],
        lastUpdate: bloodData.data.lastUpdated,
        reportDate: metadata?.report_date,
        labName: metadata?.lab_name,
        dateAnalyzed: analysis.dateAnalyzed,
        overallSummary: analysis.summary,
        title: analysis.title
      };

      return {
        success: true,
        message: 'Blood work statistics retrieved successfully',
        data: statistics
      };
    } catch (error) {
      console.error('[BloodService.getBloodWorkStatistics] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to get blood work statistics',
        error: error.message
      };
    }
  }

  /**
   * Analyze blood work directly from Base64 file data
   * This method extracts text from PDF/image files and performs AI analysis
   * @param {string} base64Data - Base64 encoded file data (PDF, PNG, or JPG)
   * @param {string} userId - User ID to save the analysis results
   * @returns {Object} Analysis result with extracted text and AI insights
   */
  static async analyzeBloodWork(base64Data, userId) {
    try {
      console.log('[BloodService.analyzeBloodWork] Starting direct blood work analysis from Base64 data');
      
      if (!base64Data) {
        throw new Error('Base64 file data is required for analysis');
      }

      // Step 1: Extract text from the Base64 file using our helper function
      console.log('[BloodService.analyzeBloodWork] Extracting text from file...');
      const extractedText = await extractTextFromBase64(base64Data);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No readable text could be extracted from the file. Please ensure the file contains clear, readable blood work data.');
      }

      const bloodWorkPrompt = BLOOD_PROMPT.replaceAll('{{LAB_DATA}}', extractedText);
      
      // Show the end of the prompt to verify replacement
      console.log('================[PROMPT END PREVIEW]================');
      console.log(bloodWorkPrompt);
      console.log('===================================================');      
      // Debug: Show first part of prompt and extracted text
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      let response;
      try {
        console.log('[BloodService.analyzeBloodWork] Calling OpenAI API...');
        response = await openai.chat.completions.create({
          model: "gpt-4o", // Using gpt-4o instead of gpt-5 which might not be available
          messages: [
            {
              role: "system",
              content: bloodWorkPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000 // Using max_tokens instead of max_completion_tokens for compatibility
        });
        console.log('[BloodService.analyzeBloodWork] OpenAI API call successful');
      } catch (openaiError) {
        console.error('[BloodService.analyzeBloodWork] OpenAI API Error:', openaiError.message);
        return {
          success: false,
          message: `OpenAI API error: ${openaiError.message}`,
          error: {
            type: 'OpenAIAPIError',
            message: openaiError.message,
            code: openaiError.code || 'unknown'
          }
        };
      }

      const analysisResult = response.choices[0]?.message?.content;
      
      if (!analysisResult || analysisResult.trim().length === 0) {
        console.error('[BloodService.analyzeBloodWork] Empty response from AI');
        console.log('[BloodService.analyzeBloodWork] Full response object:', JSON.stringify(response, null, 2));
        return {
          success: false,
          message: 'AI returned empty response. This might be due to model availability or prompt formatting issues.',
          error: 'Empty AI response',
          debug: {
            model_used: 'gpt-4o',
            response_structure: response,
            prompt_length: bloodWorkPrompt.length
          }
        };
      }

      console.log(`[BloodService.analyzeBloodWork] Received AI response: ${analysisResult}`);
      
      // Step 4: Parse and return the AI analysis result
      try {
        const parsedResult = JSON.parse(analysisResult);
        
        console.log('[BloodService.analyzeBloodWork] ✅ Blood work analysis completed successfully');
        console.log('[BloodService.analyzeBloodWork] Parsed result structure:', {
          hasAnalysis: !!parsedResult.analysis,
          topLevelKeys: Object.keys(parsedResult),
          analysisKeys: parsedResult.analysis ? Object.keys(parsedResult.analysis) : null
        });
        
        // Prepare data for saving
        const analysisData = {
          ...parsedResult, // This preserves the original structure with "analysis" property
          processing_info: {
            text_length: extractedText.length,
            analysis_timestamp: new Date().toISOString(),
            model_used: "gpt-4o",
            prompt_template: "BLOOD_PROMPT"
          }
        };
        console.log("=================[ANALYSIS DATA PREVIEW]================");
        console.log('analysisData', analysisData);
        console.log('===================================================');
        //log userId
        console.log('=================[USER ID]=========================');
        console.log('userId', userId);
        console.log('===================================================');
        
        // Save the analysis if userId is provided
        if (userId) {
          console.log('[BloodService.analyzeBloodWork] Saving analysis results to user profile...');
          const saveResult = await BloodService.saveBloodData(userId, analysisData);
          
          if (saveResult.success) {
            console.log('[BloodService.analyzeBloodWork] ✅ Analysis results saved successfully');
          } else {
            console.warn('[BloodService.analyzeBloodWork] ⚠️ Analysis completed but failed to save:', saveResult.message);
          }

          return {
            success: true,
            message: 'Blood work analysis completed and saved successfully',
            data: analysisData,
            saveResult: saveResult
          };
        }
        
        // Return analysis without saving if no userId provided
        return {
          success: true,
          message: 'Blood work analysis completed successfully',
          data: analysisData
        };
        
      } catch (parseError) {
        console.error('[BloodService.analyzeBloodWork] JSON parsing error:', parseError.message);
        console.log('[BloodService.analyzeBloodWork] Raw AI response length:', analysisResult?.length || 0);
        console.log('[BloodService.analyzeBloodWork] Raw AI response preview:', analysisResult?.substring(0, 500) || 'No content');
        
        // Try to clean up the response and parse again
        let cleanedResponse = analysisResult?.trim();
        
        // Remove any markdown code block markers
        if (cleanedResponse?.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse?.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try parsing cleaned response
        try {
          const secondAttempt = JSON.parse(cleanedResponse);
          
          console.log('[BloodService.analyzeBloodWork] ✅ JSON parsing successful on second attempt');
          console.log('[BloodService.analyzeBloodWork] Second attempt result structure:', {
            hasAnalysis: !!secondAttempt.analysis,
            topLevelKeys: Object.keys(secondAttempt),
            analysisKeys: secondAttempt.analysis ? Object.keys(secondAttempt.analysis) : null
          });
          
          // Prepare data for saving
          const analysisData = {
            extracted_text: extractedText,
            ...secondAttempt, // This preserves the original structure with "analysis" property
            processing_info: {
              text_length: extractedText.length,
              analysis_timestamp: new Date().toISOString(),
              model_used: "gpt-4o",
              prompt_template: "BLOOD_PROMPT",
              parsing_method: "cleaned"
            }
          };

          // Save the analysis if userId is provided
          if (userId) {
            console.log('[BloodService.analyzeBloodWork] Saving analysis results to user profile...');
            const saveResult = await BloodService.saveBloodData(userId, analysisData);
            
            if (saveResult.success) {
              console.log('[BloodService.analyzeBloodWork] ✅ Analysis results saved successfully');
            } else {
              console.warn('[BloodService.analyzeBloodWork] ⚠️ Analysis completed but failed to save:', saveResult.message);
            }

            return {
              success: true,
              message: 'Blood work analysis completed and saved successfully (cleaned response)',
              data: analysisData,
              saveResult: saveResult
            };
          }
          
          return {
            success: true,
            message: 'Blood work analysis completed successfully (cleaned response)',
            data: analysisData
          };
        } catch (secondParseError) {
          console.error('[BloodService.analyzeBloodWork] Second JSON parsing attempt failed:', secondParseError.message);
        }
        
        return {
          success: false,
          message: 'AI analysis completed but failed to parse results. The AI response may be malformed.',
          error: `JSON parsing failed: ${parseError.message}`,
          raw_response: analysisResult,
          debug_info: {
            response_length: analysisResult?.length || 0,
            parse_error: parseError.message
          }
        };
      }

    } catch (error) {
      console.error('[BloodService.analyzeBloodWork] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze blood work',
        error: {
          type: error.name || 'BloodWorkAnalysisError',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
    }
  }
}

module.exports = BloodService;