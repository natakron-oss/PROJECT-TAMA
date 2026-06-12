// src/App.tsx
import { useState } from 'react';
import PatientPage from './PatientPage';
import LoginPage from './LoginPage';
import './Patient.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return (
      <LoginPage
        onLogin={(username) => {
          setCurrentUser(username);
          setIsLoggedIn(true);
          setShowLogin(false);
        }}
      />
    );
  }

  return (
    <PatientPage
      currentUser={currentUser}
      isLoggedIn={isLoggedIn}
      onLogin={() => setShowLogin(true)}
      onLogout={() => {
        setCurrentUser('');
        setIsLoggedIn(false);
      }}
    />
  );
}