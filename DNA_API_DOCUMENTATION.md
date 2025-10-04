# DNA API Documentation

This document describes the DNA-specific API endpoints for managing user DNA data in the Fitra360 application.

## Overview

The DNA API provides endpoints for adding, retrieving, updating, and deleting DNA analysis data for authenticated users. The API is powered by a dedicated DNAService that handles all DNA-related operations including AncestryDNA file processing, marker extraction, and data validation.

## Base URL
```
/api/v1/user/dna
```

## Authentication
All DNA endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Architecture

The DNA API is built with a modular architecture:
- **DNAService**: Dedicated service class handling all DNA operations
- **UserController**: Handles HTTP requests and responses
- **UserProfile Model**: Stores DNA analysis data in MongoDB
- **AncestryDNA Format Support**: Specialized parsing for AncestryDNA raw data files

## Endpoints

### 1. Add DNA Data
**POST** `/api/v1/user/dna`

Adds DNA data for the authenticated user. Supports multiple input formats.

#### Request Body Options

**Option A: AncestryDNA File Upload (Base64)**
```json
{
  "fileBase64": "data:text/plain;base64,<base64_encoded_ancestrydna_file>",
  "description": "AncestryDNA raw data file"
}
```

**Option B: AncestryDNA Raw Text Data**
```json
{
  "dnaText": "rsid\tchromosome\tposition\tallele1\tallele2\nrs3131972\t1\t752721\tG\tG\nrs4040617\t1\t779322\tA\tA",
  "description": "AncestryDNA markers as text"
}
```

#### Response
```json
{
  "success": true,
  "message": "DNA data processed and saved successfully",
  "data": {
    "markersProcessed": 450,
    "processingMethod": "file_extraction",
    "analysisDate": "2025-01-02T10:30:00.000Z",
    "markers": [
      {
        "rsid": "rs1815739",
        "chromosome": "11",
        "position": "66560624",
        "allele1": "C",
        "allele2": "T"
      }
    ]
  }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Either DNA file, DNA text data, or markers array is required",
  "error": "Validation error details"
}
```

### 2. Get DNA Data
**GET** `/api/v1/user/dna`

Retrieves the DNA analysis data for the authenticated user.

#### Response (with data)
```json
{
  "success": true,
  "message": "DNA data retrieved successfully",
  "data": {
    "hasData": true,
    "totalMarkers": 450,
    "lastUpdated": "2025-01-02T10:30:00.000Z",
    "markers": [
      {
        "rs_number": "rs1815739",
        "value": "C/T",
        "chromosome": "11",
        "position": "66560624",
        "genotype": "CT",
        "category": "Fitness",
        "interpretation": "Heterozygous variant",
        "notes": "Processed via file_extraction"
      }
    ],
    "metadata": {
      "total_markers_found": 450,
      "analysis_date": "2025-01-02T10:30:00.000Z",
      "last_updated": "2025-01-02T10:30:00.000Z",
      "report_type": "raw_markers",
      "processing_method": "file_extraction"
    }
  }
}
```

#### Response (no data)
```json
{
  "success": true,
  "message": "No DNA data found for this user",
  "data": {
    "hasData": false,
    "markers": [],
    "metadata": null
  }
}
```

### 3. Update DNA Data
**PUT** `/api/v1/user/dna`

Updates existing DNA data. Can either replace all markers or merge with existing ones.

#### Request Body Options

**Option A: New AncestryDNA File Upload (Base64)**
```json
{
  "fileBase64": "data:text/plain;base64,<base64_encoded_new_ancestrydna_file>",
  "description": "Updated AncestryDNA raw data file"
}
```

**Option B: New AncestryDNA Text Data**
```json
{
  "dnaText": "rsid\tchromosome\tposition\tallele1\tallele2\nrs3131972\t1\t752721\tG\tG\nrs4040617\t1\t779322\tA\tA",
  "description": "Updated AncestryDNA data as text"
}
```

**Note:** The update operation replaces ALL existing DNA data with the new file/text data provided.

#### Response
```json
{
  "success": true,
  "message": "DNA data updated successfully",
  "data": {
    "markersUpdated": 450,
    "totalMarkers": 450,
    "processingMethod": "file_extraction",
    "lastUpdated": "2025-01-02T11:00:00.000Z"
  }
}
```

### 4. Delete DNA Data
**DELETE** `/api/v1/user/dna`

Completely removes all DNA analysis data for the authenticated user.

#### Response
```json
{
  "success": true,
  "message": "DNA data deleted successfully"
}
```

### 5. Get DNA Statistics
**GET** `/api/v1/user/dna/statistics`

Retrieves statistical information about the user's DNA data including marker counts by category.

#### Response
```json
{
  "success": true,
  "message": "DNA statistics retrieved successfully",
  "data": {
    "totalMarkers": 450,
    "categorizedMarkers": {
      "Fitness": 25,
      "Nutrition": 30,
      "Health": 40,
      "Uncategorized": 355
    },
    "uploadDate": "2025-01-02T10:30:00.000Z",
    "lastUpdated": "2025-01-02T10:30:00.000Z",
    "processingMethod": "file_extraction",
    "reportType": "raw_markers"
  }
}
```

## Data Formats

### DNA File Format Supported
- **AncestryDNA Raw Data (.txt)**: Tab-delimited format with 5 columns

### Expected AncestryDNA File Structure
```
#AncestryDNA raw data download
#This file was generated by AncestryDNA at: 06/13/2024 18:16:29 UTC
#Data was collected using AncestryDNA array version: V2.0
#Data is formatted using AncestryDNA converter version: V1.0
#Below is a text version of your DNA file from Ancestry.com DNA, LLC...
#
#Genetic data is provided below as five TAB delimited columns...
rsid	chromosome	position	allele1	allele2
rs3131972	1	752721	G	G
rs114525117	1	759036	G	G
rs4040617	1	779322	A	A
rs141175086	1	780397	C	C
rs115093905	1	787173	G	G
```

### Marker Object Structure
```json
{
  "rsid": "rs1815739",           // SNP identifier
  "chromosome": "11",            // Chromosome number
  "position": "66560624",        // Position on chromosome
  "allele1": "C",               // First allele
  "allele2": "T",               // Second allele
  "genotype": "CT",             // Combined genotype
  "category": "Fitness",         // Optional: marker category
  "interpretation": "...",       // Optional: interpretation
  "notes": "..."                // Optional: additional notes
}
```

## Error Codes

- **400**: Bad Request - Invalid input data or missing required fields
- **401**: Unauthorized - Authentication required or invalid token
- **404**: Not Found - User profile not found
- **500**: Internal Server Error - Server processing error

## Rate Limits

DNA file processing can be resource-intensive. Consider implementing rate limits:
- Max 5 DNA file uploads per day per user
- Max file size: 100MB
- Timeout: 30 seconds for processing

## Usage Examples

### JavaScript/Fetch Example
```javascript
// Add DNA data from file
const fileInput = document.getElementById('dna-file');
const file = fileInput.files[0];

const reader = new FileReader();
reader.onload = async function(e) {
  const base64 = e.target.result;
  
  const response = await fetch('/api/v1/user/dna', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      fileBase64: base64,
      description: 'DNA raw data upload'
    })
  });
  
  const result = await response.json();
  console.log(result);
};
reader.readAsDataURL(file);

// Get DNA data
const getDnaData = async () => {
  const response = await fetch('/api/v1/user/dna', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const result = await response.json();
  return result;
};
```

### cURL Examples
```bash
# Add DNA data
curl -X POST "http://localhost:3000/api/v1/user/dna" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dnaText": "rsid\tchromosome\tposition\tgenotype\nrs1815739\t11\t66560624\tCT",
    "description": "Sample DNA data"
  }'

# Get DNA data
curl -X GET "http://localhost:3000/api/v1/user/dna" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update DNA data with new AncestryDNA file
curl -X PUT "http://localhost:3000/api/v1/user/dna" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dnaText": "rsid\tchromosome\tposition\tallele1\tallele2\nrs3131972\t1\t752721\tG\tG\nrs4040617\t1\t779322\tA\tA",
    "description": "Updated AncestryDNA data"
  }'

# Delete DNA data
curl -X DELETE "http://localhost:3000/api/v1/user/dna" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Integration with Existing Systems

The DNA API integrates seamlessly with the existing Fitra360 ecosystem:

1. **Dashboard Integration**: DNA data automatically appears in the user dashboard via the `getDashboardInsight` endpoint
2. **Personalized Plans**: DNA markers are used in the `generatePersonalizedPlan` endpoint to create customized health recommendations
3. **Analysis Pipeline**: DNA data can be further processed using the existing `processImage` endpoint with `DNA_ANALYSIS` prompt types

## Security Considerations

1. **Data Privacy**: DNA data is highly sensitive personal information
2. **Encryption**: All DNA data should be encrypted at rest
3. **Access Logging**: Log all DNA data access and modifications
4. **Data Retention**: Implement proper data retention policies
5. **Consent**: Ensure proper user consent for DNA data processing

## Best Practices

1. **Validation**: Always validate DNA file formats and marker data
2. **Error Handling**: Provide clear error messages for failed uploads
3. **Progress Indicators**: Show upload/processing progress for large files
4. **Backup**: Implement proper backup strategies for DNA data
5. **Testing**: Test with various DNA file formats and edge cases