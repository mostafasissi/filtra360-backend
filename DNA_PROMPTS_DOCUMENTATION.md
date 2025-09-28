# DNA Analysis Prompts Documentation

## Overview

The Fitra360 app now supports **three different DNA analysis prompts** to handle various types of genetic data processing and reporting needs. Each prompt is designed for specific use cases and output formats.

## Available DNA Prompts

### 1. DNA_ANALYSIS (Original)
**Purpose**: Basic DNA marker extraction and analysis
**Use Case**: Simple genetic variant identification
**Output Format**: Basic JSON with markers array

```javascript
// Usage
const result = await UserService.processImage({
  text: dnaData,
  promptType: 'DNA_ANALYSIS',
  useEnhancedPrompts: false
});
```

**Output Structure**:
```json
{
  "dna_analysis": {
    "markers": [
      {
        "rs_number": "rs1801133",
        "value": "CT",
        "notes": "Basic interpretation"
      }
    ],
    "metadata": {
      "total_markers_found": 1,
      "analysis_date": "2024-01-01",
      "patient_id": "if available"
    }
  }
}
```

### 2. DNA_ANALYSIS_ENHANCED
**Purpose**: Advanced genetic analysis with categorization
**Use Case**: Detailed genetic insights with health categories
**Output Format**: Enhanced JSON with categories and interpretations

```javascript
// Usage
const result = await UserService.processImage({
  text: dnaData,
  promptType: 'DNA_ANALYSIS_ENHANCED',
  useEnhancedPrompts: true
});
```

**Output Structure**:
```json
{
  "dna_analysis": {
    "markers": [
      {
        "rs_number": "rs1801133",
        "value": "CT",
        "category": "Methylation",
        "interpretation": "Heterozygous variant affecting folate metabolism",
        "notes": "May benefit from methylated folate supplementation"
      }
    ],
    "metadata": {
      "total_markers_found": 1,
      "analysis_date": "2024-01-01",
      "patient_id": "if available"
    }
  }
}
```

### 3. DNA_ANALYSIS_COMPREHENSIVE ⭐ (New)
**Purpose**: Complete Fitra360 DNA report generation
**Use Case**: Full genetic health report with actionable recommendations
**Output Format**: Fitra360 structured report matching your provided JSON template

```javascript
// Usage
const result = await UserService.processImage({
  text: dnaData,
  promptType: 'DNA_ANALYSIS_COMPREHENSIVE',
  useEnhancedPrompts: true
});
```

**Output Structure**: Matches your exact JSON template with sections A-F:
```json
{
  "meta": {
    "engine": "GPT-5",
    "framework": "Fitra360 DNA",
    "version": "1.0.0",
    "generatedAt": "2025-09-11T13:15:00Z",
    "inputSnpCount": 6,
    "recognizedSnps": ["rs4988235", "rs762551", "..."],
    "unrecognizedSnps": []
  },
  "sections": {
    "A": {
      "title": "Nutrition & Food Sensitivities",
      "traits": [...]
    },
    "B": {
      "title": "Vitamins & Metabolism",
      "traits": [...]
    }
    // ... sections C, D, E, F
  }
}
```

## SNP Coverage

All prompts analyze the same comprehensive list of SNPs:

**Supported SNPs**: rs4988235, rs762551, rs10156191, rs1801133, rs1801394, rs1229984, rs4680, rs6265, rs4570625, rs1800497, rs1801131, rs662, rs1050450, rs4880, rs162036, rs1799883, rs662799, rs9939609, rs10757278, rs7903146, rs1801282, rs3812316, rs5219, rs1815739, rs12594956, rs1042713, rs429358, rs7412, rs671, rs1042714, rs1800896, rs1800629, rs9340799, rs1256049, rs1048943, rs731236, rs1544410, rs17612546, rs228697

## Section Mapping (Comprehensive Prompt)

- **Section A** (Nutrition & Food Sensitivities): rs4988235 (lactose), rs10156191 (histamine), rs762551 (caffeine)
- **Section B** (Vitamins & Metabolism): rs1801133 (MTHFR), rs1801394 (MTRR), rs1801131 (MTHFR A1298C)
- **Section C** (Fitness & Body): rs1815739 (ACTN3), rs4570625 (muscle fiber), rs12594956 (exercise response)
- **Section D** (Sleep & Behavior): rs4680 (COMT), rs6265 (BDNF), rs1800497 (DRD2)
- **Section E** (Appearance & Longevity): rs429358/rs7412 (APOE), rs1048943 (aging), rs731236 (vitamin D receptor)
- **Section F** (Health Predispositions): rs1229984 (alcohol metabolism), rs671 (ALDH2), rs1800896 (inflammation)

## Data Storage

### Standard & Enhanced Analysis
Stored in `UserProfile.dnaAnalysis`:
```javascript
{
  markers: [...],
  metadata: {
    total_markers_found: Number,
    analysis_date: String,
    last_updated: Date,
    report_type: 'standard' | 'enhanced'
  }
}
```

### Comprehensive Analysis
Stored in `UserProfile.dnaAnalysis`:
```javascript
{
  markers: [...], // Unified markers array
  comprehensiveReport: {...}, // Full Fitra360 report
  metadata: {
    total_markers_found: Number,
    analysis_date: String,
    last_updated: Date,
    report_type: 'comprehensive'
  }
}
```

## API Usage Examples

### Basic Processing
```javascript
const result = await UserService.processImage({
  fileBase64: pdfBase64Data, // or null if using text
  text: dnaRawData, // raw DNA data string
  promptType: 'DNA_ANALYSIS_COMPREHENSIVE',
  useEnhancedPrompts: true,
  userId: 'user-id-here'
});
```

### Save Analysis Data
```javascript
const saveResult = await UserService.saveAnalysisData(userId, {
  promptType: 'DNA_ANALYSIS_COMPREHENSIVE',
  analysis: result.data.chatGPTAnalysis.analysis
});
```

## Input Data Formats

### Text Format
```
rs4988235: GG
rs762551: AA
rs10156191: CT
rs1801133: CT
rs1801394: AG
rs1229984: TT
```

### PDF Format
Upload a PDF containing genetic test results with rs numbers and genotypes.

## Error Handling

The system includes comprehensive validation:

1. **Structure Validation**: Ensures output matches expected format
2. **SNP Validation**: Only processes recognized SNPs
3. **Data Integrity**: Validates genotype formats
4. **Storage Validation**: Ensures proper database storage

## Testing

Use the provided test file:
```bash
node Fitra-app/test_dna_comprehensive.js
```

## Choosing the Right Prompt

| Use Case | Prompt Type | Best For |
|----------|-------------|----------|
| Simple extraction | `DNA_ANALYSIS` | Basic genetic data extraction |
| Detailed analysis | `DNA_ANALYSIS_ENHANCED` | Health insights with categories |
| Complete report | `DNA_ANALYSIS_COMPREHENSIVE` | Full Fitra360 health reports |

## Migration Guide

If you're currently using the original DNA prompts and want to upgrade:

1. **From DNA_ANALYSIS to DNA_ANALYSIS_ENHANCED**:
   - Change `promptType` to `'DNA_ANALYSIS_ENHANCED'`
   - Set `useEnhancedPrompts: true`
   - Expect additional fields: `category`, `interpretation`

2. **From DNA_ANALYSIS_ENHANCED to DNA_ANALYSIS_COMPREHENSIVE**:
   - Change `promptType` to `'DNA_ANALYSIS_COMPREHENSIVE'`
   - Expect completely different output structure (Fitra360 format)
   - Access full report via `comprehensiveReport` field in database

## Support

For questions or issues with the DNA analysis prompts:
1. Check the console logs for detailed processing information
2. Verify SNP format matches expected patterns
3. Ensure `useEnhancedPrompts: true` for enhanced and comprehensive prompts
4. Review the test file for working examples
