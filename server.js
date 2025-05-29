require('dotenv').config();
 // Load environment variables from .env file
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME ;

let db;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// Connect to MongoDB
MongoClient.connect(MONGODB_URI)
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db(DB_NAME);
    })
    .catch(error => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// API Routes

// Validate student by ID and record attendance
app.post('/api/validate-student', async (req, res) => {
    try {
        const { student_id } = req.body;
        
        if (!student_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Student ID is required' 
            });
        }

        // Find student in database
        const student = await db.collection('students').findOne({ 
            student_id: student_id.toString() 
        });

        if (!student) {
            return res.status(404).json({ 
                success: false, 
                message: 'Student not found in database',
                student_id: student_id
            });
        }

        // Check if student already marked attendance today
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const existingAttendance = await db.collection('attendance').findOne({
            student_id: student_id.toString(),
            timestamp: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        if (existingAttendance) {
            return res.json({
                success: true,
                alreadyMarked: true,
                message: 'Attendance already marked for today',
                student: {
                    student_id: student.student_id,
                    name: student.name,
                    email: student.email
                },
                attendanceTime: existingAttendance.timestamp
            });
        }

        // Record new attendance
        const attendanceRecord = {
            student_id: student.student_id,
            name: student.name,
            email: student.email,
            timestamp: new Date(),
            date: startOfDay,
            status: 'present'
        };

        await db.collection('attendance').insertOne(attendanceRecord);

        res.json({
            success: true,
            alreadyMarked: false,
            message: 'Attendance recorded successfully',
            student: {
                student_id: student.student_id,
                name: student.name,
                email: student.email
            },
            attendanceTime: attendanceRecord.timestamp
        });

    } catch (error) {
        console.error('Validate student error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Get today's attendance records
app.get('/api/attendance/today', async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const attendanceRecords = await db.collection('attendance')
            .find({
                timestamp: {
                    $gte: startOfDay,
                    $lt: endOfDay
                }
            })
            .sort({ timestamp: -1 })
            .toArray();

        res.json({
            success: true,
            attendance: attendanceRecords,
            count: attendanceRecords.length
        });

    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Get attendance statistics
app.get('/api/stats', async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        // Count today's attendance
        const todayCount = await db.collection('attendance').countDocuments({
            timestamp: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        // Count total students
        const totalStudents = await db.collection('students').countDocuments();

        // Calculate attendance percentage
        const attendancePercentage = totalStudents > 0 ? 
            ((todayCount / totalStudents) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            stats: {
                totalStudents,
                presentToday: todayCount,
                absentToday: totalStudents - todayCount,
                attendancePercentage
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Get all students (for verification)
app.get('/api/students', async (req, res) => {
    try {
        const students = await db.collection('students')
            .find({})
            .sort({ student_id: 1 })
            .toArray();

        res.json({
            success: true,
            students,
            count: students.length
        });

    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Import students from Excel (if needed)
app.post('/api/import-students', async (req, res) => {
    try {
        const { students } = req.body;
        
        if (!Array.isArray(students) || students.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Students array is required'
            });
        }

        // Clear existing students (optional)
        // await db.collection('students').deleteMany({});

        // Insert new students
        const result = await db.collection('students').insertMany(students);

        res.json({
            success: true,
            message: `Imported ${result.insertedCount} students`,
            insertedCount: result.insertedCount
        });

    } catch (error) {
        console.error('Import students error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));

});

app.get('/thank_you.wav', (req, res) => {
    res.sendFile(path.join(__dirname, 'thank_you.wav'));
});

app.get('/try_again.wav', (req, res) => {
    res.sendFile(path.join(__dirname, 'try_again.wav'));
});

app.get('/aitrich-logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'aitrich-logo.png'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: db ? 'Connected' : 'Disconnected'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found' 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
});