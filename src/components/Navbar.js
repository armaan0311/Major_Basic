import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css'; 
import { FaBookReader } from "react-icons/fa";

const Navbar = ({ onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2><FaBookReader /> PREP TALK</h2>
      </div>
      <ul className="navbar-menu">
      <li>
          <Link to="/interview-preparation">Interview Preparation</Link>
        </li> 
        
       
        <li>
          <Link to="/news">News</Link>
        </li>
       
        <li>
          <Link to="/">Mentorships</Link>
        </li>
        <li>
          <Link to="/chatbot">PrepAI</Link>
        </li>
        <li>
          <Link to="/AboutUs">About</Link>
        </li>
      </ul>
      <div className="navbar-login">
        <button onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;
