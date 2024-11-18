import React, { useEffect, useState } from 'react';
import Card from './Card';

const Newsapp = () => {
    const [search, setSearch] = useState("Job Openings"); // Default search term for Job Openings
    const [newsData, setNewsData] = useState(null);
    const API_KEY = "49a55d1778a947b98984e2e8991465a2";

    const getData = async () => {
        try {
            const response = await fetch(`https://newsapi.org/v2/everything?q=${search}&apiKey=${API_KEY}`);
            const jsonData = await response.json();
            console.log(jsonData.articles);
            const dt = jsonData.articles.slice(0, 10); // Limit to top 10 articles
            setNewsData(dt);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    useEffect(() => {
        getData(); // Fetch data when the component loads
    }, []); // Run only once when the component is mounted

    const handleInput = (e) => {
        setSearch(e.target.value);
    };

    const userInput = (event) => {
        setSearch(event.target.value);
    };

    return (
        <div>
            <nav>
                <div>
                    <h1>Trending News</h1>
                </div>
                <ul style={{ display: "flex", gap: "11px" }}>
                    
                </ul>
                <div className="searchBar">
                    <input
                        type="text"
                        placeholder="Search News"
                        value={search}
                        onChange={handleInput}
                    />
                    <button onClick={getData}>Search</button>
                </div>
            </nav>
            <div>
                <p className="head">Stay Updated</p>
            </div>
            <div className="categoryBtn">
                <button onClick={userInput} value="Stocks">Stocks</button>
                <button onClick={userInput} value="Market">Market</button>
                <button onClick={userInput} value="Job Openings">Job Openings</button>
                <button onClick={userInput} value="Employment">Employment</button>
                <button onClick={userInput} value="AI">AI</button>
            </div>
            <div>
                {newsData ? <Card data={newsData} /> : <p>Loading...</p>}
            </div>
        </div>
    );
};

export default Newsapp;
