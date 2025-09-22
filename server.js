const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
// const fs = require('fs'); // Nu mai este necesar pentru ștergerea locală a fișierelor
const { BlobServiceClient } = require('@azure/storage-blob'); // Asigură-te că este instalat: npm install @azure/storage-blob

const app = express();
const PORT = process.env.PORT || 5001;
require('dotenv').config();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Permite cereri de la frontend-ul React local
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
// Este bine să existe pentru gestionarea cererilor preflight OPTIONS
app.options(/.*/, cors());

app.use(express.json({ limit: '10mb' })); // Mărește limita dacă ai poze mari
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware pentru a servi fișierele statice din folderul 'uploads' - Poți șterge această linie dacă nu mai folosești stocarea locală
// app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// Conectare MongoDB (schimbă cu linkul tău)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/persondb')
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
  photo: String, // Va stoca URL-ul de la Blob Storage
  createdBy: String,
});
const Person = mongoose.model('Person', personSchema);

// Config Multer pentru a stoca fișierul temporar în memorie (pentru Blob Storage)
const upload = multer({
  storage: multer.memoryStorage(), // Stochează fișierul ca buffer în req.file.buffer
  limits: {
    fileSize: 10 * 1024 * 1024, // Limită 10MB (opțional)
  },
  fileFilter: (req, file, cb) => {
    // Acceptă doar imagini (opțional)
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Funcție helper pentru încărcarea în Blob Storage
async function uploadToBlobStorage(buffer, originalname, containerName = 'uploads') {
  try {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set in environment variables.");
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Asigură-te că numele blob-ului este unic și sigur
    const timestamp = Date.now();
    const uniqueSuffix = Math.random().toString(36).substring(2, 15);
    // Înlăturăm caracterele periculoase din numele fișierului
    const safeOriginalName = originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const blobName = `${timestamp}-${uniqueSuffix}-${safeOriginalName}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const uploadBlobResponse = await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype || 'application/octet-stream' } // Păstrează tipul MIME original
    });

    console.log(`✅ Upload blob ${blobName} successfully. RequestId: ${uploadBlobResponse.requestId}`);

    // Returnează URL-ul public al imaginii
    return blockBlobClient.url;
  } catch (error) {
    console.error("❌ Eroare la încărcarea în Blob Storage:", error.message);
    throw error;
  }
}

// Rute API

// GET toate persoanele
app.get('/api/persons', async (req, res) => {
  try {
    const persons = await Person.find().sort({ club: 1, lastName: 1, firstName: 1 });
    res.json(persons);
  } catch (err) {
    console.error("❌ Eroare la GET /api/persons:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST adaugă persoană
app.post('/api/persons', upload.single('photo'), async (req, res) => {
  console.log("➡️ Primire cerere POST /api/persons");
  // console.log("Body:", req.body); // Poate fi mult
  console.log("File (multer):", req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'Niciun fișier');

  let photoUrl = null;

  try {
    // Dacă a fost încărcată o poză, încarc-o în Blob Storage
    if (req.file) {
      console.log("⬆️ Încărcare poză în Blob Storage...");
      photoUrl = await uploadToBlobStorage(req.file.buffer, req.file.originalname);
      console.log("🖼️ URL poză (Blob Storage):", photoUrl);
    }

    const { firstName, lastName, sotiePartenera, birthDate, functie, club, city, profession, telefon, email, createdBy } = req.body;

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
      photo: photoUrl // Salvează URL-ul în loc de calea locală
    });

    const newPerson = await person.save();
    console.log("✅ Persoană salvată în DB:", newPerson._id);
    res.status(201).json(newPerson);
  } catch (err) {
    console.error('❌ Eroare la salvare (POST /api/persons):', err.message);
    // În caz de eroare la upload sau salvare, poți alege să ștergi blob-ul din storage dacă e necesar (mai avansat)
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Șterge o persoană după ID
app.delete('/api/persons/:id', async (req, res) => {
  try {
    const person = await Person.findByIdAndDelete(req.params.id);
    if (!person) {
      console.log(`🔍 Persoana cu ID ${req.params.id} nu a fost găsită pentru ștergere.`);
      return res.status(404).json({ message: 'Persoana nu a fost găsită' });
    }

    console.log(`🗑️ Persoana ${person.firstName} ${person.lastName} (${person._id}) a fost ștearsă din DB.`);

    // Dacă vrei să ștergi și poza din Blob Storage, ai nevoie de numele blob-ului.
    // Acesta poate fi extras din URL-ul `person.photo`.
    // Implementarea ștergerii din Blob Storage este opțională și mai avansată.
    // if (person.photo) {
    //   // Logica pentru ștergerea din Blob Storage
    // }

    res.json({ message: 'Persoana a fost ștearsă cu succes' });
  } catch (err) {
    console.error('❌ Eroare la ștergere (DELETE /api/persons/:id):', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Servește frontend-ul React în producție
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
  });
}

// Pornire serverr
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server rulează pe http://localhost:${PORT}`);
});
