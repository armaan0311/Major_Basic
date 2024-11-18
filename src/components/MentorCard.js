import React from 'react';
import { Link } from 'react-router-dom';
import './MentorCard.css';

// Importing all mentor images
import shrutiImage from '../images/teacher1.jpg';
import anuradhaImage from '../images/teacher2.jpeg';
import pankajImage from '../images/teacher3.jpg';
import raviImage from '../images/teacher5.jpg';
import ankitImage from '../images/teacher6.jpg';
import nehaImage from '../images/teacher7.jpg';
import priyaImage from '../images/teacher8.png';
import simranImage from '../images/teacher9.jpg';
import vikramImage from '../images/teacher10.jpg';

// Define the default image URL
const defaultImage = 'https://via.placeholder.com/80';

// Image map to associate mentor names with images
const imageMap = {
  "Shruti Gupta": shrutiImage,
  "Anuradha Gupta": anuradhaImage,
  "Pankaj Mishra": pankajImage,
  "Ravi Sharma": raviImage,
  "Neha Patel": nehaImage,
  "Ankit Singh": ankitImage,
  "Priya Soni": priyaImage,
  "Vikram Mehra": vikramImage,
  "Simran Kaur": simranImage,
};

const MentorCard = ({ mentor, onMentorSelect }) => {
  if (!mentor) {
    return <div>Mentor data is not available</div>; // Handling missing mentor data
  }

  const { name, domain, experience, rating } = mentor;

  // Fallback to defaultImage if the mentor's image is not available in imageMap
  const mentorImage = imageMap[name] || defaultImage;

  return (
    <div className="mentor-card" onClick={() => onMentorSelect(mentor)}>
      <div className="mentor-photo-container">
        <img src={mentorImage} alt={name} className="mentor-photo" />
      </div>
      <div className="mentor-info">

        <h2 className="mentor-name">{name}</h2>
        <p>Domain: {domain}</p>
        <p>Experience: {experience} years</p>
        <p>Rating: {rating}/5</p>
      </div>
    </div>
  );
};

export default MentorCard;
