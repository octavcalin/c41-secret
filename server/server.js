const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conectare MongoDB (schimbă cu linkul tău)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/persondb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
    .then(() => console.log('✅ Conectat la MongoDB'))
    .catch(err => console.log('❌ Eroare MongoDB:', err));

// Model Persoană

const personSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    sotiePartenera: String,
    birthDate: Date,
    functie: String,
    club: { type: String, default: 'Fără club' },
    city: String,
    profession: String,
    telefon: String,
    email: String,
    photo: String,
    createdBy: String,
});
const Person = mongoose.model('Person', personSchema);

// Config Multer (pentru upload poze)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Rute API

// GET toate persoanele
app.get('/api/persons', async (req, res) => {
    try {
        const persons = await Person.find().sort({ club: 1, lastName: 1, firstName: 1 });
        res.json(persons);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST adaugă persoană
app.post('/api/persons', upload.single('photo'), async (req, res) => {
    const { firstName, lastName, sotiePartenera, birthDate, functie, club, city, profession, telefon, email, createdBy } = req.body;
    const photo = req.file ? `/uploads/${req.file.filename}` : null;

    const person = new Person({
        firstName,
        lastName,
        sotiePartenera,
        birthDate,
        functie,
        club,
        city,
        profession,
        telefon,
        email,
        createdBy,
        photo
    });
    try {
        const newPerson = await person.save();
        res.status(201).json(newPerson);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE - Șterge o persoană după ID
app.delete('/api/persons/:id', async (req, res) => {
    try {
        const person = await Person.findByIdAndDelete(req.params.id);
        if (!person) {
            return res.status(404).json({ message: 'Persoana nu a fost găsită' });
        }

        // 🗑️ Șterge și fișierul foto (opțional, dar recomandat)
        if (person.photo) {
            const fs = require('fs');
            const filePath = path.join(__dirname, 'uploads', path.basename(person.photo));
            fs.unlink(filePath, (err) => {
                if (err) console.log('❌ Nu s-a putut șterge fișierul:', filePath);
                else console.log('✅ Fișier șters:', filePath);
            });
        }

        res.json({ message: 'Persoana a fost ștearsă cu succes' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Pornire server
app.listen(PORT, () => {
    console.log(`🚀 Server rulează pe http://localhost:${PORT}`);
});