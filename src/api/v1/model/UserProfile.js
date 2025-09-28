const mongoose = require("mongoose");

/**
 * UserProfile Schema
 * Stores detailed health and fitness related information for users
 */
const userProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
            unique: true,
            index: true
        },
        isProfileComplete: {
            type: Boolean,
            default: false
        },
        step: {
            type: Number,
            default: 1,
        },
        // Basic profile info
        dateOfBirth: {
            type: Date,
            validate: {
                validator: function (v) {
                    return v <= new Date();
                },
                message: "Date of birth cannot be in the future"
            }
        },
        sexAtBirth: {
            type: String,
            enum: {
                values: ["Male", "Female", "Other"],
                message: "{VALUE} is not a valid sex at birth"
            }
        },
        height: {
            type: Number,
            min: [0, "Height cannot be negative"],
            max: [300, "Height seems unrealistic"]
        },
        heightUnit: {
            type: String,
            enum: ["cm", "in"],
            default: "cm"
        },
        weight: {
            type: Number,
            min: [0, "Weight cannot be negative"],
            max: [500, "Weight seems unrealistic"]
        },
        weightUnit: {
            type: String,
            enum: ["kg", "lbs"],
            default: "kg"
        },
        location: {
            type: String,
            trim: true,
            maxLength: [100, "Location name cannot be more than 100 characters"]
        },

        // Body measurements (in centimeters or inches)
        waistCircumference: {
            type: Number,
            min: [0, "Waist circumference cannot be negative"],
            max: [200, "Waist circumference seems unrealistic"]
        },
        chestCircumference: {
            type: Number,
            min: [0, "Chest circumference cannot be negative"],
            max: [200, "Chest circumference seems unrealistic"]
        },
        armCircumference: {
            type: Number,
            min: [0, "Arm circumference cannot be negative"],
            max: [100, "Arm circumference seems unrealistic"]
        },
        circumferenceUnit: {
            type: String,
            enum: ["cm", "in"],
            default: "cm"
        },

        // Lifestyle
        dietType: {
            type: String,
            enum: {
                values: [
                    "Omnivore",
                    "Vegetarian",
                    "Vegan",
                    "Pescatarian",
                    "Paleo",
                    "Keto",
                    "Low-Carb",
                    "Mediterranean",
                    "Carnivore",
                    "Flexitarian",
                    "Gluten-Free",
                    "Dairy-Free",
                    "Custom/Other"
                ],
                message: "{VALUE} is not a valid diet type"
            }
        },
        exerciseLevel: {
            type: String,
            enum: {
                values: ["Sedentary", "Moderate", "Active"],
                message: "{VALUE} is not a valid exercise level"
            }
        },
        sleepQuality: {
            type: String,
            enum: {
                values: ["Poor", "Medium", "Good"],
                message: "{VALUE} is not a valid sleep quality rating"
            }
        },
        smokes: {
            type: Boolean,
            default: false
        },
        drinksAlcohol: {
            type: String,
            enum: {
                values: ["Never", "Occasionally", "Regularly"],
                message: "{VALUE} is not a valid alcohol consumption frequency"
            }
        },

        // Heart Health
        restingHeartRate: {
            type: Number,
            min: [30, "Heart rate cannot be below 30 bpm"],
            max: [200, "Heart rate cannot exceed 200 bpm"],
            validate: {
                validator: function(v) {
                    return Number.isInteger(v);
                },
                message: "Heart rate must be a whole number"
            }
        },
        bloodPressure: {
            systolic: {
                type: Number,
                min: [70, "Systolic pressure cannot be below 70 mmHg"],
                max: [250, "Systolic pressure cannot exceed 250 mmHg"]
            },
            diastolic: {
                type: Number,
                min: [40, "Diastolic pressure cannot be below 40 mmHg"],
                max: [150, "Diastolic pressure cannot exceed 150 mmHg"]
            }
        },
        irregularHeartbeat: {
            type: Boolean,
            default: false
        },
        chestPain: {
            hasPain: {
                type: Boolean,
                default: false
            },
            when: {
                type: String,
                enum: {
                    values: [
                        "At rest",
                        "During physical activity",
                        "During emotional stress",
                        "After eating",
                        "At night while lying down",
                        "Both at rest and during activity"
                    ],
                    message: "{VALUE} is not a valid chest pain trigger"
                }
            }
        },
        swellingInAnklesOrFeet: {
            type: Boolean,
            default: false
        },
        familyHistoryOfHeartDisease: {
            type: Boolean,
            default: false
        },

        // Symptoms & goals
        symptoms: [{
            type: String,
            trim: true
        }],
        goals: [{
            type: String,
            trim: true
        }],

        // Optional uploads
        uploads: [{
            type: {
                type: String,
                enum: {
                    values: ["DNA", "Blood Work", "Supplements"],
                    message: "{VALUE} is not a valid upload type"
                },
                required: [true, "Upload type is required"]
            },
            fileUrl: {
                type: String,
                required: [true, "File URL is required"],
                trim: true
            },
            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }],

        // DNA Analysis Data
        dnaAnalysis: {
            markers: [{
                rs_number: {
                    type: String,
                    required: true,
                    trim: true
                },
                value: {
                    type: String,
                    required: true,
                    trim: true
                },
                category: {
                    type: String,
                    trim: true
                },
                interpretation: {
                    type: String,
                    trim: true
                },
                notes: {
                    type: String,
                    trim: true
                }
            }],
            metadata: {
                total_markers_found: Number,
                analysis_date: Date,
                last_updated: {
                    type: Date,
                    default: Date.now
                }
            }
        },

        // Blood Report Data
        bloodReport: {
            patient_info: {
                name: String,
                id: String,
                date: Date
            },
            results: {
                cbc: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                chemistry: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                lipids: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                hormones: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                vitamins: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                other: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }]
            },
            metadata: {
                total_tests: Number,
                report_date: Date,
                lab_name: String,
                last_updated: {
                    type: Date,
                    default: Date.now
                }
            }
        },

        // Supplements & Medications
        supplementsAndMedications: [{
            name: { type: String, required: true, trim: true },
            brand: { type: String, trim: true },
            form: { type: String, trim: true }, // e.g., Capsule, Tablet, etc.
            dosage: { type: String, trim: true },
            frequency: { type: String, trim: true },
            timing: { type: String, trim: true },
            purpose: { type: String, trim: true }
        }],

        dailyLogs: [{
            date: { type: Date, required: true },
            symptoms: [{
                name: String,
                severity: Number, // e.g., 1-10
                note: String,
                contextTags: [String]
            }],
            weight: {
                value: Number,
                unit: { type: String, default: "kg" }
            },
            note: {
                text: String,
                tags: [String],
                digestionMood: Number // e.g., 1-5 scale
            }
        }],

        dashboardInsight: {
            result: { type: Object }, // Store the dashboard summary/result
            lastAnalyzedAt: { type: Date }
        },
        
        // Track if profile has been updated since last dashboard analysis
        isUpdated: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for faster queries
userProfileSchema.index({ userId: 1 });

// Virtual for BMI calculation
userProfileSchema.virtual('bmi').get(function () {
    if (this.height && this.weight) {
        // Convert height from cm to m and calculate BMI
        const heightInMeters = this.height / 100;
        return (this.weight / (heightInMeters * heightInMeters)).toFixed(2);
    }
    return null;
});

// Pre-save middleware to ensure data consistency
userProfileSchema.pre('save', function (next) {
    // Trim all string fields
    for (let key in this._doc) {
        if (typeof this[key] === 'string') {
            this[key] = this[key].trim();
        }
    }
    
    // Set isUpdated to true if this is a modification (not a new document)
    // Note: This middleware only runs on .save() calls, not on findOneAndUpdate()
    if (!this.isNew) {
        console.log(`[UserProfile] Profile updated for userId: ${this.userId}, setting isUpdated = true`);
        console.log(`[UserProfile] Previous isUpdated value: ${this.isUpdated}`);
        this.isUpdated = true;
        console.log(`[UserProfile] New isUpdated value: ${this.isUpdated}`);
    } else {
        console.log(`[UserProfile] New profile created for userId: ${this.userId}, isUpdated remains: ${this.isUpdated}`);
    }
    
    next();
});

module.exports = mongoose.model("UserProfile", userProfileSchema);
