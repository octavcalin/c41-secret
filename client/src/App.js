import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5001' ;

// Generează un ID unic pentru utilizatorul curent (dacă nu există)
const getOrCreateUserId = () => {
  let userId = localStorage.getItem('user_id');
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('user_id', userId);
  }
  return userId;
};

const CURRENT_USER_ID = getOrCreateUserId();

const DELETE_PASSWORD = 'parola123'; // 👈 SCHIMBĂ CU O PAROLĂ SIGURĂ!
function App() {
  const [persons, setPersons] = useState([]);
  const [selectedClub, setSelectedClub] = useState('toate'); // 'toate' = afișează tot
  const [selectedCity, setSelectedCity] = useState('toate');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false); // ✅ ascuns inițial

  // Lista cluburilor — poți extinde
  const cluburi = [
    'Club 41 Nr.1 Brașov',
    'Club 41 Nr.2 Drobeta Turnu Severin',
    'Club 41 Nr.3 Brașov',
    'Club 41 Nr.4 Craiova',
    'Club 41 Nr.5 Câmpulung',
    'Club 41 Nr.6 Suceava',
    'Club 41 Nr.7 Brașov',
    'Club 41 Nr.8 Slatina',
    'Club 41 Nr.9 Craiova',
    'Club 41 Nr.10 Suceava',
    'Club 41 Nr.11 Galați',
    'Club 41 Nr.12 Sibiu',
    'Club 41 Nr.14 București'
  ];

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    sotiePartenera: '',
    birthDate: '',
    functie: '',
    club: '',
    city: '',
    profession: '',
    telefon: '',
    email: '',
    photo: null
  });
  // Obține lista de orașe unice
  const cities = [...new Set(persons.map(person => person.city))].sort();
  // 🔽 CALCULEAZĂ filteredPersons AICI
  const filteredPersons = persons.filter(person => {
    const matchClub = selectedClub === 'toate' || person.club === selectedClub;
    const matchCity = selectedCity === 'toate' || person.city === selectedCity;
    const matchSearch = searchTerm === '' ||
      `${person.firstName} ${person.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${person.lastName} ${person.firstName}`.toLowerCase().includes(searchTerm.toLowerCase());

    return matchClub && matchCity && matchSearch;
  });
  const handleDelete = async (id, createdBy) => {
    // Verifică dacă utilizatorul curent este cel care a creat înregistrarea
    if (createdBy === CURRENT_USER_ID) {
      // ✅ Ștergere fără parolă
      if (!window.confirm('Ești sigur că vrei să ștergi această înregistrare?')) {
        return;
      }
    } else {
      // 🔐 Ștergere cu parolă (pentru alții)
      const userPassword = prompt('🔐 Introdu parola de administrator pentru ștergere:');
      if (userPassword !== DELETE_PASSWORD) {
        alert('❌ Parolă incorectă! Ștergerea a fost anulată.');
        return;
      }

      if (!window.confirm('Ești SIGUR că vrei să ștergi această înregistrare? Această acțiune este ireversibilă!')) {
        return;
      }
    }

    try {
      await axios.delete(`${API_BASE}/api/persons/${id}`);
      alert('✅ Înregistrarea a fost ștearsă!');
      loadPersons();
    } catch (error) {
      console.error('Eroare la ștergere:', error);
      alert('A apărut o eroare la ștergere.');
    }
  };

  useEffect(() => {
    loadPersons();
  }, []);

  const loadPersons = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/persons`);
      setPersons(res.data);
    } catch (error) {
      console.error('Eroare la încărcare persoane:', error);
    }
  };

  // Funcție pentru normalizarea numelui/prenumelui
  const normalizeName = (str) => {
    if (!str) return '';
    return str
      .trim()                          // elimină spațiile de la început/sfârșit
      .toLowerCase()                   // toate literele mici
      .replace(/\s+/g, ' ')            // înlocuiește multiple spații cu unul singur
      .replace(/(^|\s)\S/g, match => match.toUpperCase()); // majusculă la începutul fiecărui cuvânt
  };

  // Funcție pentru normalizarea și formatarea numărului de telefon
  const normalizePhone = (str) => {
    if (!str) return '';

    // 1. Elimină tot ce nu e cifră
    let cleaned = str.replace(/\D/g, '');

    // 2. Dacă începe cu 0 și are 10 cifre → elimină 0 și adaugă +40
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '+40' + cleaned.substring(1); // elimină primul 0
    }

    // 3. Dacă are 9 cifre (fără prefix) → adaugă +40
    if (cleaned.length === 9 && !cleaned.startsWith('+')) {
      cleaned = '+40' + cleaned;
    }

    // 4. Dacă începe cu 40 și are 11 cifre → adaugă +
    if (cleaned.startsWith('40') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    }

    // 5. Dacă e în format internațional corect (+40XXXXXXXXX, 12 cifre) → formatează frumos
    if (cleaned.startsWith('+40') && cleaned.length === 12) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 12)}`;
      // Ex: "+40 755 220 600"
    }

    // 6. Returnează ce a rămas (dacă nu se potrivește niciun caz)
    return cleaned;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Normalizare automată pentru nume și prenume
    let normalizedValue = value;
    if (name === 'firstName' || name === 'lastName' || name === 'profession' || name === 'city' || name === 'sotiePartenera' || name === 'functie') {
      normalizedValue = normalizeName(value);
    }
    setFormData({
      ...formData,
      [name]: normalizedValue
    });
  };

  const handleFileChange = (e) => {
    setFormData({
      ...formData,
      photo: e.target.files[0]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ VALIDARE TELEFON
    const phoneDigits = formData.telefon.replace(/\D/g, ''); // extrage doar cifrele
    if (phoneDigits.length < 9) {
      alert('❌ Numărul de telefon este prea scurt! Introdu un număr valid.');
      return; // oprește trimiterea
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      alert('❌ Adresa de email nu este validă!');
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('firstName', formData.firstName);
    formDataToSend.append('lastName', formData.lastName);
    formDataToSend.append('sotiePartenera', formData.sotiePartenera);
    formDataToSend.append('birthDate', formData.birthDate);
    formDataToSend.append('functie', formData.functie);
    formDataToSend.append('club', formData.club);
    formDataToSend.append('city', formData.city);
    formDataToSend.append('profession', formData.profession);
    formDataToSend.append('telefon', formData.telefon);
    formDataToSend.append('email', formData.email);
    formDataToSend.append('createdBy', CURRENT_USER_ID);
    if (formData.photo) {
      formDataToSend.append('photo', formData.photo);
    }

    console.log('➡️ API_BASE:', API_BASE);
    console.log('➡️ URL final:', `${API_BASE}/api/persons`);

    try {
      await axios.post(`${API_BASE}/api/persons`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setFormData({
        firstName: '',
        lastName: '',
        sotiePartenera: '',
        birthDate: '',
        functie: '',
        club: cluburi[0],
        city: '',
        profession: '',
        telefon: '',
        photo: null
      });

      loadPersons();
      setSuccessMessage('Datele au fost trimise cu succes!');
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000); // Dispare după 5 secunde
      setSelectedClub('toate');
    } catch (error) {
      console.error('Eroare la adăugare:', error);
      alert('A apărut o eroare la adăugare.');
    }
  };

  return (
    <div className="app-container">
      <div className="header-wrapper">
        <img src="/logo.svg" alt="Club 41 România" className="app-logo" />
        <div className="header-text">
          <h1 className="main-title">Secretariat Club 41 România</h1>
          <h2 className="subtitle">Declarație de membri pentru Anuarul Clubului: 2025–2026</h2>
        </div>
      </div>
      {showForm && (
        <div className="form-container">
          <form onSubmit={handleSubmit} className="person-form">
            <input
              name="firstName"
              placeholder="Prenume"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              title="Prenumele este obligatoriu"
              className="form-input"
            />
            <input
              name="lastName"
              placeholder="Nume"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              title="Numele este obligatoriu"
              className="form-input"
            />
            <input
              name="sotiePartenera"
              placeholder="Soție / Parteneră"
              value={formData.sotiePartenera}
              onChange={handleInputChange}
              className="form-input"
            />
            <div className="date-input-wrapper">
              <label className="date-label">
                Data nașterii (zz.ll.aaaa):
              </label>
              <input
                name="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={handleInputChange}
                required
                className="form-input date-input"
                placeholder="Selectează data nașterii"
                title="Selectează data nașterii (zi / lună / an)"
              />
            </div>
            <input
              name="functie"
              placeholder="Funcție în cadrul clubului local (dacă există)"
              value={formData.functie}
              onChange={handleInputChange}
              className="form-input"
            />
            <select
              name="club"
              value={formData.club}
              onChange={handleInputChange}
              className="form-input"
              required
            >
              <option value="" disabled selected>
                🎯 Alege clubul în care activați
              </option>
              {cluburi.map(club => (
                <option key={club} value={club}>{club}</option>
              ))}
            </select>
            <input
              name="city"
              placeholder="Orașul de domiciliu"
              value={formData.city}
              onChange={handleInputChange}
              required
              title="Orasul de domiciliu este obligatoriu"
              className="form-input"
            />
            <input
              name="profession"
              placeholder="Profesie"
              value={formData.profession}
              onChange={handleInputChange}
              required
              title="Profesia este obligatorie"
              className="form-input"
            />
            <input
              name="telefon"
              placeholder=" Telefon,  ex: 0721 345 678"
              value={formData.telefon}
              onChange={handleInputChange}
              onBlur={(e) => {                   // 👈 normalizează DOAR când pleacă focusul
                let value = e.target.value;
                if (!value.trim()) {
                  setFormData({
                    ...formData,
                    telefon: ''
                  });
                  return;
                }
                const normalized = normalizePhone(e.target.value);
                setFormData({
                  ...formData,
                  telefon: normalized
                });
              }}
              required
              title="Introdu numărul de telefon (ex: 0712 345 678)"
              className="form-input"
            />
            {formData.telefon && (
              <div className="preview-normalized">
                👀 Se va salva ca: <strong>{normalizePhone(formData.telefon)}</strong>
              </div>
            )}
            <input
              name="email"
              placeholder="Email (ex: ion.popescu@email.com)"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              type="email" // 👈 pentru validare browser
              title="Introdu o adresă de email validă"
            />
            <div className="file-upload-wrapper">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                id="photo-upload"
                className="file-upload-input"
              />
              <label htmlFor="photo-upload" className="file-upload-label">
                📷 Alege o fotografie
              </label>
              {formData.photo && (
                <div className="file-name">
                  ✅ {formData.photo.name}
                </div>
              )}
            </div>
            {formData.photo && (
              <img
                src={URL.createObjectURL(formData.photo)}
                alt="Previzualizare"
                className="photo-preview"
              />
            )}
            <button type="submit" className="submit-button">
              Transmite datele introduse
            </button>
          </form>
        </div>
      )}
      {successMessage && (
        <div className="success-message">
          ✅ {successMessage}
        </div>
      )}
      {/* Container pentru ambele filtre pe aceeași linie */}
      <div className="filters-inline">
        {/* Filtru club */}
        <div className="filter-item">
          <label>Club: </label>
          <select
            value={selectedClub}
            onChange={(e) => {
              setSelectedClub(e.target.value);
              setSelectedCity('toate'); // resetează orașul la schimbarea clubului (opțional)
            }}
            className="filter-select"
          >
            <option value="toate">Toate cluburile</option>
            {cluburi.map(club => (
              <option key={club} value={club}>{club}</option>
            ))}
          </select>
        </div>

        {/* Filtru oraș */}
        <div className="filter-item">
          <label>Oraș: </label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="filter-select"
          >
            <option value="toate">Toate orașele</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Bara de căutare */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Caută după nume sau prenume..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="clear-search"
            title="Șterge căutarea"
          >
            ✕
          </button>
        )}
      </div>
      {/* Numărătoare membri */}
      <div className="members-counter">
        📊 {filteredPersons.length} membri afișați din {persons.length} total
      </div>
      {/* Buton pentru a afișa/formularul */}
      <div className="add-member-button-container">
        <button
          onClick={() => setShowForm(!showForm)}
          className="add-member-button"
        >
          {showForm ? 'Ascunde formular' : '➕ Adaugă Membru'}
        </button>
      </div>
      {/* Listă persoane — grupate și sortate */}
      <div className="persons-container">
        {filteredPersons
          .map(person => (
            <div key={person._id} className="person-card">
              <img
                src={person.photo ? `${API_BASE}${person.photo}` : '/default-avatar2.jpg'}
                alt="Foto"
                className={`person-photo ${person.photo ? 'has-photo' : ''}`}
                onError={(e) => {
                  e.target.src = '/default-avatar2.jpg';
                }}
              />
              <h3 className="person-name">{person.lastName} {person.firstName}</h3>
              {/* DETALII — aliniate la stânga */}
              <div className="person-details-left">
                {person.sotiePartenera && (
                  <p className="person-detail">❤️ Soție/Parteneră: {person.sotiePartenera}</p>
                )}
                <p className="person-detail">🎂 Data naștere: {new Date(person.birthDate).toLocaleDateString('ro-RO')}</p>
                {person.functie && (
                  <p className="person-detail">👔 Funcție: {person.functie}</p>
                )}
                <p className="person-detail">🏛️ {person.club}</p>
                <p className="person-detail">🏙️ Oraș: {person.city}</p>
                {person.profession && (
                  <p className="person-detail">💼 Profesie: {person.profession}</p>
                )}
                {person.telefon && (
                  <p className="person-detail">📱 Telefon: {person.telefon}</p>
                )}
                {person.email && (
                  <p className="person-detail"><span className="email-icon">✉️</span> Email: {person.email}</p>
                )}
                {person.createdBy === CURRENT_USER_ID && (
                  <span className="self-tag">👑 Propria înregistrare</span>
                )}
              </div>

              <button
                onClick={() => handleDelete(person._id, person.createdBy)}
                className="delete-button"
              >
                ❌ Șterge
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

export default App;