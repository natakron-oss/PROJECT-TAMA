// src/App.tsx
import { useState } from 'react';
import PatientPage from './PatientPage';
import LoginPage from './LoginPage';
import './Patient.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'user'>('user'); // ✅ เพิ่ม

  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return (
      <LoginPage
        onLogin={(username, role) => {                    // ✅ รับ role
          setCurrentUser(username);
          setUserRole(role as 'admin' | 'user');          // ✅ เก็บ role
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
      userRole={userRole}                                 // ✅ ส่งลงไป
      onLogin={() => setShowLogin(true)}
      onLogout={() => {
        setCurrentUser('');
        setUserRole('user');                              // ✅ reset role
        setIsLoggedIn(false);
      }}
    />
  );
}