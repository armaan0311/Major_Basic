import React, { useState, useEffect } from 'react';
import './AboutUs.css';  // Create a separate CSS file for the styles

const AboutUs = () => {
    const [activeIndex, setActiveIndex] = useState(null);

    const toggleFAQ = (index) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    const faqs = [
        {
            question: "What is PrepTalk and how does it work?",
            answer: "PrepTalk is a platform designed to help students prepare for interviews and career opportunities. It offers direct access to job listings, internship opportunities, mentorship programs, learning resources, and AI-driven support. Students can explore company-specific preparation resources, connect with industry mentors, and stay updated on the latest career news."
        },
        {
            question: "How can I connect with mentors through PrepTalk?",
            answer: "You can easily browse a list of available mentors in the Mentors section. Each mentor profile includes their expertise and background. Once you find a mentor who aligns with your interests, you can send them a message or schedule a session to discuss your career-related queries and get guidance."
        },
        {
            question: "How do I find job and internship opportunities on PrepTalk?",
            answer: "The Jobs and Internships sections provide curated listings of the latest opportunities. You can search and filter based on your interests, industry, or location, and apply directly through the provided links to the respective company’s application process."
        },
        {
            question: "How does the AI chatbot assist users?",
            answer: "The AI chatbot on PrepTalk is available 24/7 to answer your queries, provide interview tips, and guide you through the platform. It can suggest job opportunities, provide company-specific resources, and help you navigate the features of PrepTalk to make the most out of your preparation."
        },
        {
            question: "Can I customize my learning resources based on my career interests?",
            answer: "Yes, you can personalize your experience by selecting fields or companies that you’re interested in. PrepTalk will then tailor the resources, job listings, and mentorship suggestions based on your preferences, helping you focus on the opportunities most relevant to your goals."
        },
        {
            question: "Is PrepTalk free to use, and how secure is my data?",
            answer: "Yes, PrepTalk is completely free to use for all students. The platform ensures that your data is safe with secure authentication and encryption methods. Your personal information will remain private and will not be shared without your consent."
        },
    ];

    useEffect(() => {
        // Trigger confetti when the page is loaded
        const confetti = document.getElementById("confetti");
        confetti.classList.add("active");
    }, []);  // Run once on mount

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f9f9f9' }}>
            {/* Confetti animation container */}
            <div id="confetti" className="confetti"></div>

            <h1 style={{
                textAlign: 'center', color: '#3b3b3b', fontSize: '2.5rem', fontWeight: 'bold', letterSpacing: '1px',
                position: 'relative'
            }}>
                About Us
            </h1>
            <p style={{
                maxWidth: '800px', margin: '0 auto', textAlign: 'center', color: '#555', fontSize: '1.1rem', lineHeight: '1.8',
                marginBottom: '30px', fontStyle: 'italic', letterSpacing: '0.5px'
            }}>
                Welcome to <strong style={{ color: '#FF69B4' }}>PrepTalk</strong>, your all-in-one platform for interview preparation and career advancement.
                Whether you're a student preparing for your first interview or a professional looking to explore new opportunities, PrepTalk is here to support you.
                Our platform offers a wide range of resources, including company-specific interview materials, personalized mentorship from experienced professionals,
                and the latest job listings tailored to your field. Additionally, our AI-powered chatbot is ready to assist with your questions,
                providing insights to help you stay on track. At PrepTalk, we’re committed to making your preparation journey seamless, efficient, and successful.
            </p>

            <h2 style={{
                marginTop: '40px', color: '#3b3b3b', fontSize: '1.8rem', fontWeight: '600', letterSpacing: '1px',
                textAlign: 'center', borderBottom: '2px solid #FF69B4', paddingBottom: '5px'
            }}>
                Frequently Asked Questions
            </h2>

            <div style={{ marginTop: '25px', maxWidth: '800px', margin: '0 auto' }}>
                {faqs.map((faq, index) => (
                    <div
                        key={index}
                        style={{
                            borderBottom: '1px solid #ddd', padding: '15px 20px', cursor: 'pointer', borderRadius: '8px',
                            backgroundColor: activeIndex === index ? '#FFE4E1' : 'transparent',
                            transition: 'background-color 0.3s ease, transform 0.3s ease',
                            transform: activeIndex === index ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: activeIndex === index ? '0 5px 15px rgba(0, 0, 0, 0.1)' : 'none',
                        }}
                        onClick={() => toggleFAQ(index)}
                    >
                        <p
                            style={{
                                fontWeight: 'bold', color: '#333', marginBottom: '8px', fontSize: '1.1rem',
                                transition: 'color 0.3s ease', letterSpacing: '0.5px'
                            }}
                        >
                            {faq.question}
                        </p>
                        {activeIndex === index && (
                            <p style={{
                                marginLeft: '20px', color: '#555', fontSize: '1rem', fontStyle: 'italic', lineHeight: '1.6',
                                transition: 'opacity 0.3s ease', opacity: activeIndex === index ? 1 : 0
                            }}>
                                {faq.answer}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AboutUs;
