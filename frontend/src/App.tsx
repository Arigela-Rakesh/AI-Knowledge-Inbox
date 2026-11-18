import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import MyKnowledge from './pages/MyKnowledge';
import AddKnowledge from './pages/AddKnowledge';
import AskAI from './pages/AskAI';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/knowledge" element={<MyKnowledge />} />
            <Route path="/add" element={<AddKnowledge />} />
            <Route path="/ask" element={<AskAI />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
