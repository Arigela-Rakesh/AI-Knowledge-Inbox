import React, { useState } from 'react';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, useTheme, useMediaQuery, IconButton } from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate, useLocation } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';

const DRAWER_WIDTH = 256;

const navItems = [
  { label: 'Dashboard', icon: <DashboardRoundedIcon />, path: '/' },
  { label: 'My Knowledge', icon: <LibraryBooksRoundedIcon />, path: '/knowledge' },
  { label: 'Add Knowledge', icon: <AddCircleOutlineRoundedIcon />, path: '/add' },
  { label: 'Ask AI', icon: <AutoAwesomeRoundedIcon />, path: '/ask' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSelected = (path: string) => path === '/'
    ? location.pathname === path
    : location.pathname.startsWith(path);

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2.5, py: 2.6, display: 'flex', alignItems: 'center', gap: 1.4 }}>
        <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: 'primary.main', color: 'white', flexShrink: 0 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 21 }} />
        </Box>
        <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.98rem', letterSpacing: '-0.02em' }}>
          AI Knowledge Inbox
        </Typography>
        {isMobile && (
          <IconButton aria-label="Close navigation" onClick={() => setMobileOpen(false)} sx={{ ml: 'auto' }}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      <Divider />
      <Typography variant="overline" sx={{ px: 2.5, pt: 2.5, pb: 1, color: 'text.disabled', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.66rem' }}>
        Workspace
      </Typography>
      <List sx={{ flex: 1, px: 1.25, pt: 0 }}>
        {navItems.map(item => (
          <ListItemButton
            key={item.path}
            selected={isSelected(item.path)}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            sx={{
              minHeight: 46,
              px: 1.5,
              borderRadius: 2.5,
              mb: 0.55,
              color: 'text.secondary',
              transition: 'background-color 140ms ease, color 140ms ease',
              '&:hover': { bgcolor: '#f0efff', color: 'primary.dark' },
              '&.Mui-selected': {
                bgcolor: '#eeedff',
                color: 'primary.dark',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
                '& .MuiListItemText-primary': { fontWeight: 700 },
              },
              '&.Mui-selected:hover': { bgcolor: '#e9e7ff' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 39, color: 'inherit' }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 550 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2 }}>
        <Box sx={{ p: 1.5, bgcolor: '#f0efff', borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 17, color: 'primary.main' }} />
          <Typography variant="caption" color="primary.dark" fontWeight={600}>Your knowledge, connected</Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {isMobile && (
        <IconButton aria-label="Open navigation" onClick={() => setMobileOpen(true)} sx={{ position: 'fixed', top: 14, left: 14, zIndex: 1300, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(32,35,56,0.08)' }}>
          <MenuIcon />
        </IconButton>
      )}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: '#fbfbfe',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}
