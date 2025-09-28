# DNA Analysis API Endpoints

## Base URL
```
http://localhost:3000
```
(or your deployed server URL)

## Authentication
All DNA analysis endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 🧬 DNA Analysis Endpoints

### 1. Process DNA Analysis (Original)
**Endpoint:** `POST /api/v1/users/process-image`

**Description:** Basic DNA analysis using the original prompt

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "fileBase64": "data:text/plain;base64,cnM0OTg4MjM1OiBHRwpyczc2MjU1MTogQUEKcnMxMDE1NjE5MTogQ1QKcnMxODAxMTMzOiBDVApyczE4MDEzOTQ6IEEK",
  "promptType": "DNA_ANALYSIS",
  "useEnhancedPrompts": false
}
```

**Alternative with text (for testing):**
```json
{
  "text": "rs4988235: GG\nrs762551: AA\nrs10156191: CT\nrs1801133: CT\nrs1801394: AG\nrs1229984: TT",
  "promptType": "DNA_ANALYSIS",
  "useEnhancedPrompts": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "File processed successfully",
  "data": {
    "fileType": "text",
    "contentType": "text/plain",
    "extractedText": "rs4988235: GG\nrs762551: AA...",
    "chatGPTAnalysis": {
      "analysis": {
        "dna_analysis": {
          "markers": [
            {
              "rs_number": "rs4988235",
              "value": "GG",
              "notes": "Basic interpretation"
            }
          ],
          "metadata": {
            "total_markers_found": 6,
            "analysis_date": "2025-01-15"
          }
        }
      },
      "promptType": "DNA_ANALYSIS",
      "enhancedPromptsUsed": false
    }
  }
}
```

---

### 2. Process DNA Analysis (Enhanced)
**Endpoint:** `POST /api/v1/users/process-image-enhanced`

**Description:** Enhanced DNA analysis with categories and detailed interpretations

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "fileBase64": "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO4CjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMCA3NTAgVGQKKHJzNDk4ODIzNTogR0cpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIwNCAwMDAwMCBuIAowMDAwMDAwMjk4IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzk2CiUlRU9G",
  "promptType": "DNA_ANALYSIS_ENHANCED",
  "useEnhancedPrompts": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "File processed successfully",
  "data": {
    "chatGPTAnalysis": {
      "analysis": {
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
            "total_markers_found": 6,
            "analysis_date": "2025-01-15",
            "report_type": "enhanced"
          }
        }
      },
      "promptType": "DNA_ANALYSIS_ENHANCED",
      "enhancedPromptsUsed": true
    }
  }
}
```

---

### 3. Process DNA Analysis (Comprehensive) ⭐ **NEW**
**Endpoint:** `POST /api/v1/users/process-image-enhanced`

**Description:** Complete Fitra360 DNA report matching your JSON structure

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "fileBase64": "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO4CjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggMTQ4Cj4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAgNzUwIFRkCihyczQ5ODgyMzU6IEdHKSBUagowIC0yMCBUZAoocnM3NjI1NTE6IEFBKSBUagowIC0yMCBUZAoocnMxMDE1NjE5MTogQ1QpIFRqCjAgLTIwIFRkCihyczE4MDExMzM6IENUKSBUagowIC0yMCBUZAoocnMxODAxMzk0OiBBRykgVGoKMCAtMjAgVGQKKHJzMTIyOTk4NDogVFQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIwNCAwMDAwMCBuIAowMDAwMDAwNDAyIDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTAwCiUlRU9G",
  "promptType": "DNA_ANALYSIS_COMPREHENSIVE",
  "useEnhancedPrompts": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "File processed successfully",
  "data": {
    "chatGPTAnalysis": {
      "analysis": {
        "meta": {
          "engine": "GPT-3.5-Turbo",
          "framework": "Fitra360 DNA",
          "version": "1.0.0",
          "generatedAt": "2025-01-15T10:30:00Z",
          "inputSnpCount": 6,
          "recognizedSnps": ["rs4988235", "rs762551", "rs10156191", "rs1801133", "rs1801394", "rs1229984"],
          "unrecognizedSnps": []
        },
        "sections": {
          "A": {
            "title": "Nutrition & Food Sensitivities",
            "traits": [
              {
                "name": "Lactose Digestion",
                "whyItMatters": "Lactase is the enzyme that digests milk sugar...",
                "snpsUsed": [
                  {
                    "rsid": "rs4988235",
                    "genotype": "GG",
                    "note": "LCT persistence variant..."
                  }
                ],
                "result": "Genotype suggests low lactase persistence.",
                "impact": "Higher chance of symptoms with milk, cream, and soft cheeses.",
                "action": {
                  "diet": ["Prefer lactose-free milk, hard cheeses, kefir..."],
                  "supplements": [],
                  "lifestyle": ["Track symptoms after dairy meals"],
                  "fasting": [],
                  "oralHealth": []
                },
                "status": "risk",
                "evidence": "established",
                "missingSnps": []
              }
            ],
            "summary": [
              "Genetics suggest lactose intolerance—use lactose-free options.",
              "Histamine clearance variant—consider lower-histamine diet if symptomatic."
            ]
          },
          "B": {
            "title": "Vitamins & Metabolism",
            "traits": [...],
            "summary": [...]
          }
          // ... sections C, D, E, F
        }
      },
      "promptType": "DNA_ANALYSIS_COMPREHENSIVE",
      "enhancedPromptsUsed": true
    }
  }
}
```

---

### 4. Process DNA from PDF File
**Endpoint:** `POST /api/v1/users/process-image` or `POST /api/v1/users/process-image-enhanced`

**Description:** Upload and process DNA data from PDF files

**Request Body:**
```json
{
  "fileBase64": "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO4...",
  "promptType": "DNA_ANALYSIS_COMPREHENSIVE",
  "useEnhancedPrompts": true
}
```

---

### 5. Save Analysis Data
**Endpoint:** `POST /api/v1/users/save-analysis`

**Description:** Manually save DNA analysis data to user profile

**Request Body:**
```json
{
  "promptType": "DNA_ANALYSIS_COMPREHENSIVE",
  "analysis": {
    "meta": {...},
    "sections": {...}
  }
}
```

---

### 6. Get User Profile with DNA Data
**Endpoint:** `GET /api/v1/users/:userId`

**Description:** Retrieve user profile including stored DNA analysis

**Response:**
```json
{
  "message": "User updated successfully.",
  "user": {
    "_id": "60d5ecb54b24a1234567890a",
    "email": "user@example.com",
    "profile": {
      "dnaAnalysis": {
        "markers": [...],
        "comprehensiveReport": {...}, // Full Fitra360 report for comprehensive analysis
        "metadata": {
          "total_markers_found": 6,
          "analysis_date": "2025-01-15T10:30:00Z",
          "last_updated": "2025-01-15T10:30:15.123Z",
          "report_type": "comprehensive"
        }
      }
    }
  },
  "success": true
}
```

---

## 📋 cURL Examples

### Basic DNA Analysis (with text file base64)
```bash
curl -X POST http://localhost:3000/api/v1/users/process-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fileBase64": "data:text/plain;base64,cnM0OTg4MjM1OiBHRwpyczE4MDExMzM6IENUK3JzMTIyOTk4NDogVFQ=",
    "promptType": "DNA_ANALYSIS",
    "useEnhancedPrompts": false
  }'
```

### Enhanced DNA Analysis (with PDF base64)
```bash
curl -X POST http://localhost:3000/api/v1/users/process-image-enhanced \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fileBase64": "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO4CjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMCA3NTAgVGQKKHJzNDk4ODIzNTogR0cpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIwNCAwMDAwMCBuIAowMDAwMDAwMjk4IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzk2CiUlRU9G",
    "promptType": "DNA_ANALYSIS_ENHANCED",
    "useEnhancedPrompts": true
  }'
```

### Comprehensive DNA Analysis (NEW) - with base64
```bash
curl -X POST http://localhost:3000/api/v1/users/process-image-enhanced \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fileBase64": "data:text/plain;base64,cnM0OTg4MjM1OiBHRwpyczc2MjU1MTogQUEKcnMxMDE1NjE5MTogQ1QKcnMxODAxMTMzOiBDVApyczE4MDEzOTQ6IEEK",
    "promptType": "DNA_ANALYSIS_COMPREHENSIVE",
    "useEnhancedPrompts": true
  }'
```

---

## 📁 File Processing Workflow

### How it Works:
1. **Upload File**: Send base64 encoded file (PDF, text, or other supported formats)
2. **Extract Content**: System automatically extracts text content from the file
3. **Process with GPT**: Extracted text is sent to the appropriate DNA analysis prompt
4. **Return Results**: Get comprehensive DNA analysis matching your chosen format

### Supported File Types:
- **PDF**: `data:application/pdf;base64,<base64-content>`
- **Text**: `data:text/plain;base64,<base64-content>`
- **CSV**: `data:text/csv;base64,<base64-content>`

### How to Generate Base64:

**JavaScript (Frontend):**
```javascript
// For file upload
const file = event.target.files[0];
const reader = new FileReader();
reader.onload = function(e) {
  const base64String = e.target.result; // This includes the data:type;base64, prefix
  // Send to API
  fetch('/api/v1/users/process-image-enhanced', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fileBase64: base64String,
      promptType: 'DNA_ANALYSIS_COMPREHENSIVE',
      useEnhancedPrompts: true
    })
  });
};
reader.readAsDataURL(file);
```

**Command Line (for testing):**
```bash
# Convert text file to base64
base64 dna_data.txt

# Or with data URL prefix
echo "data:text/plain;base64,$(base64 -w 0 dna_data.txt)"
```

**Example DNA data file content:**
```
rs4988235: GG
rs762551: AA
rs10156191: CT
rs1801133: CT
rs1801394: AG
rs1229984: TT
```

---

## 🔧 Request Parameters

### Required Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `promptType` | string | One of: `DNA_ANALYSIS`, `DNA_ANALYSIS_ENHANCED`, `DNA_ANALYSIS_COMPREHENSIVE` |

### Optional Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | Raw DNA data (rs numbers with genotypes) |
| `fileBase64` | string | Base64 encoded PDF file |
| `useEnhancedPrompts` | boolean | Set to `true` for enhanced/comprehensive prompts |
| `userId` | string | Automatically extracted from JWT token |

---

## 🚨 Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "Either file data or text is required"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to process file: [error details]"
}
```

---

## 📊 Supported SNPs

All endpoints support the following SNPs:
- rs4988235, rs762551, rs10156191, rs1801133, rs1801394, rs1229984
- rs4680, rs6265, rs4570625, rs1800497, rs1801131, rs662, rs1050450
- rs4880, rs162036, rs1799883, rs662799, rs9939609, rs10757278
- rs7903146, rs1801282, rs3812316, rs5219, rs1815739, rs12594956
- rs1042713, rs429358, rs7412, rs671, rs1042714, rs1800896
- rs1800629, rs9340799, rs1256049, rs1048943, rs731236
- rs1544410, rs17612546, rs228697

---

## 🎯 Quick Start

1. **Get JWT Token**: Login via `/api/v1/users/login`
2. **Process DNA**: Use any of the DNA analysis endpoints above
3. **View Results**: Check the response or retrieve via user profile endpoint
4. **Use Comprehensive**: For full Fitra360 reports, use `DNA_ANALYSIS_COMPREHENSIVE`

The new **DNA_ANALYSIS_COMPREHENSIVE** prompt generates the exact JSON structure you provided in your query, making it perfect for your Fitra360 app's DNA reporting needs!
