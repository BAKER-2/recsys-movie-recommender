# 🎬 Personalized Movie Recommender System

A full-stack, web-based **personalized movie recommendation system** built using **collaborative filtering (ALS matrix factorization)** trained on the **MovieLens 20M dataset**, enriched with **TMDB metadata**, and deployed as a public interactive website.

🔗 [**Live Demo** ](https://recsys-movie-recommender.vercel.app) 


---

## 📌 Project Overview

This project implements an end-to-end recommender system that:
- Learns user preferences from explicit ratings
- Generates personalized movie recommendations
- Allows interactive filtering and real-time refinement
- Is accessible via a public web interface

The goal of the project is **not commercialization**, but to demonstrate a **practical, theoretically grounded recommender system** aligned with concepts covered in a recommender systems course.

---

## 🧠 Recommender System Methodology

### Model: Collaborative Filtering (ALS)

- **Algorithm:** Alternating Least Squares (ALS)
- **Training data:** MovieLens 20M (≈20 million ratings, ≈27k movies)
- **Latent dimension:** 128
- **Objective:** Factorize the user–item interaction matrix into latent embeddings

Each movie is represented as a latent vector.  
A user preference vector is constructed dynamically at inference time from the user’s ratings.

### User Vector Construction
- Ratings are **mean-centered** (rating − 3)
- User vector = weighted average of rated movie vectors
- Final recommendation score = **dot product** between user vector and item vectors

This ensures:
- Personalized ranking
- Exclusion of already-rated items
- Generalization to unseen users (cold-start handled via onboarding ratings)

---

## 🔍 Recommendation Pool Strategy

- The system computes a **ranked pool of the top 2,500 movies** per user
- Only **50 recommendations are displayed at a time**
- Filters dynamically scan further down the ranked list to always maintain 50 results

This design ensures:
- Filtering does not reduce recommendation count
- Rankings remain consistent with the learned model
- Smooth user experience even with strict filters

---

## 🎛️ User-Side Features

### Onboarding
- Users rate a curated, diverse set of movies
- Ratings are stored locally (no account required)

### Recommendation Filters
- **Decade**
- **Runtime**
  - Short movies (< 100 min)
  - Long movies (> 160 min)
- **Language**
- **Genre**

### Interaction
- Ranked recommendations (1–50)
- “Watched” button removes a movie from the list
- Rankings automatically shift and refill from the pool
- Rated and watched movies are always excluded

---

## 🖥️ Web Application Stack

### Frontend
- **Next.js (App Router)**
- **React**
- **Tailwind CSS**
- Fully client-side interaction
- Responsive UI with posters, carousel, and animations

### Backend (API Routes)
- Loads pretrained ALS item factors
- Computes user vectors and scores in real time
- Efficient top-K selection using a heap
- TMDB enrichment with concurrency limiting and caching

### External APIs
- **TMDB API** for:
  - Posters
  - Runtime
  - Director
  - Genres
  - Language
  - Overview

---

## 🚀 Deployment

- Deployed on **Vercel**
- Publicly accessible URL
- No authentication required
- Environment variables used for secure API keys

---

## 📂 Repository Structure

.
├── app/
│   ├── page.tsx          # Homepage (carousel + navigation)
│   ├── rate/             # Rating interface
│   ├── results/          # Recommendations + filters
│   └── api/recommend/    # Recommendation API
├── data/
│   ├── item_factors.f32
│   ├── movie_ids.json
│   ├── movieId_to_tmdb.json
│   └── pretrained assets
├── public/
│   ├── onboarding_250_diverse.json
│   └── images/
├── README.md
└── package.json

---

## 🧪 Academic Concepts Demonstrated

- Collaborative filtering
- Matrix factorization
- Latent factor models
- Cold-start mitigation
- Ranking vs filtering separation
- Offline training + online inference
- Evaluation by interaction rather than static metrics

---

## 👤 Authors

- **Baker Husein**
- **Izla Haoues**

---

## 📎 Notes

This project was developed as a **final course project** for a recommender systems class.  
All design decisions prioritize **clarity, correctness, and alignment with theory** over production-scale optimization.
