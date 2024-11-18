import React, { useState } from 'react';
import './MentorProfile.css'; // Updated CSS for styling
import { Link } from 'react-router-dom';
import { FaEnvelope, FaStar, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const defaultImage = 'https://via.placeholder.com/150';

const imageMap = {
  "Shruti Gupta": require('../images/teacher1.jpg'),
  "Anuradha Gupta": require('../images/teacher2.jpeg'),
  "Pankaj Mishra": require('../images/teacher3.jpg'),
  "Ravi Sharma": require('../images/teacher5.jpg'),
  "Neha Patel": require('../images/teacher7.jpg'),
  "Ankit Singh": require('../images/teacher6.jpg'),
  "Priya Soni": require('../images/teacher8.png'),
  "Vikram Mehra": require('../images/teacher10.jpg'),
  "Simran Kaur": require('../images/teacher9.jpg'),
};

const MentorProfile = ({ mentor }) => {
  // Declare state hooks at the top level
  const [showEducation, setShowEducation] = useState(false);
  const [showExperience, setShowExperience] = useState(false);
  const [showPublications, setShowPublications] = useState(false);

  if (!mentor) return <div>No mentor selected.</div>;

  const { 
    name, 
    position, 
    domain, 
    experience, 
    photo, 
    rating, 
    email, 
    biography, 
    education, 
    work_experience, 
    research_interests, 
    publications 
  } = mentor;

  const mentorImage = imageMap[name] || defaultImage;

  return (
    <div className="mentor-profile">
      <div className="mentor-card">
        <img src={mentorImage} alt={name} className="mentor-photo" />
        <div className="mentor-info">
          <h2>{name}</h2>
          <p className="mentor-position">{position}</p>
          <p><strong>Domain:</strong> {domain}</p>
          <p><strong>Experience:</strong> {experience} years</p>
          <p><strong>Rating:</strong> <FaStar className="star-icon" /> {rating}/5</p>
          <p>
            <FaEnvelope /> <a href={`mailto:${email}`} className="mentor-email">{email}</a>
          </p>
          <div className="bio">
            <strong>Biography:</strong>
            <p>{biography || 'No biography available'}</p>
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="collapsible-section">
        <button onClick={() => setShowEducation(!showEducation)} className="collapsible-button">
          Education {showEducation ? <FaChevronUp /> : <FaChevronDown />}
        </button>
        {showEducation && (
          <div className="collapsible-content">
            <ul>
              {education?.phd && <li>PhD: {education.phd.degree}, {education.phd.institution} ({education.phd.year})</li>}
              {education?.mtech && <li>M.Tech: {education.mtech.degree}, {education.mtech.institution} ({education.mtech.year})</li>}
              {education?.btech && <li>B.Tech: {education.btech.degree}, {education.btech.institution} ({education.btech.year})</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="collapsible-section">
        <button onClick={() => setShowExperience(!showExperience)} className="collapsible-button">
          Work Experience {showExperience ? <FaChevronUp /> : <FaChevronDown />}
        </button>
        {showExperience && (
          <div className="collapsible-content">
            <ul>
              {work_experience?.map((job, index) => (
                <li key={index}>
                  {job.role} at {job.organization} ({job.duration})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="collapsible-section">
        <button onClick={() => setShowPublications(!showPublications)} className="collapsible-button">
          Publications {showPublications ? <FaChevronUp /> : <FaChevronDown />}
        </button>
        {showPublications && (
          <div className="collapsible-content">
            <ul>
              {publications?.map((pub, index) => (
                <li key={index}>
                  {pub.title} ({pub.journal}, {pub.year})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="collapsible-section">
        <strong>Research Interests:</strong>
        <ul>
          {research_interests?.map((interest, index) => (
            <li key={index}>{interest}</li>
          ))}
        </ul>
      </div>

      {/* Contact Button */}
      <Link to={`http://localhost:3000/chats?person=${name}`}>
        <button className="contact-button">Contact</button>
      </Link>
    </div>
  );
};

export default MentorProfile;
