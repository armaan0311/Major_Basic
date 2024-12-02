import React, { useState } from 'react'; 
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import MentorList from './components/MentorList';
import MentorProfile from './components/MentorProfile';
import InterviewPreparation from './components/InterviewPreparation';
import AboutUs from './components/AboutUs';
import mentorsData from './components/mentorsData.json';
import Newsapp from './components/Newsapp';
import Chatbot from './components/Chatbot';
import './App.css';

function App() {
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [filteredMentors, setFilteredMentors] = useState(mentorsData);
  const [filters, setFilters] = useState({
    availabilityFilter: 'all',
    sortOption: 'name',
    skillFilter: 'all',
    topMentorFilter: 'top-rated',
  });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const applyFilters = (filters) => {
    let filtered = mentorsData;

    if (filters.availabilityFilter !== 'all') {
      filtered = filtered.filter((mentor) => mentor.availability === filters.availabilityFilter);
    }
    if (filters.skillFilter !== 'all') {
      filtered = filtered.filter((mentor) => mentor.skills.includes(filters.skillFilter));
    }
    if (filters.topMentorFilter === 'top-rated') {
      filtered = filtered.filter((mentor) => mentor.rating >= 4);
    }

    switch (filters.sortOption) {
      case 'name':
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'experience':
        filtered = filtered.sort((a, b) => b.experience - a.experience);
        break;
      case 'rating':
        filtered = filtered.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }

    setFilteredMentors(filtered);
  };

  return (
    <Router>
      <Navbar />
      <div className="app-container">
        <Routes>
          <Route
            path="/"
            element={
              <div className="mentor-container">
                <div className="mentor-list-container">
                  <MentorList mentors={filteredMentors} onMentorSelect={setSelectedMentor} />
                </div>
                <div className="mentor-profile-container">
                  {selectedMentor ? (
                    <MentorProfile mentor={selectedMentor} />
                  ) : (
                    <div>Select a mentor to see their profile</div>
                  )}
                </div>
              </div>
            }
          />
          <Route path="/news" element={<Newsapp />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/interview-preparation" element={<InterviewPreparation />} />
          <Route path="/AboutUs" element={<AboutUs />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
