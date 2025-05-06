# Surf App Upgrade PRD

## Overview
This Product Requirements Document (PRD) outlines a series of planned upgrades to the current surf tracking application. These upgrades include simplifying the wave path representation, adding real data upload capabilities, introducing dark mode, and revamping the session detail page UI.

## 1. Wave Path Simplification

### Current Issue
The current coordinate array implementation for wave paths is overly complex and data-intensive.

### Requirements
- **Remove unnecessary data**: 
  - Eliminate speed values
  - Remove heatmap functionality
- **Simplify line visualization**:
  - Use only orange-colored lines for all wave paths
  - Remove start and end markers
  - Implement rounded, smooth lines to represent wave paths

### Success Criteria
- Reduced data footprint
- Consistent, simplified visual representation of wave paths

## 2. Real Session Upload & Database Logic

### Feature Description
Enable users to upload real surfing session data from external devices via CSV files.

### Requirements
#### File Upload
- Add a "Upload CSV" button on the session page
- Accept CSV files with strictly ordered columns: 
  - Time
  - Latitude
  - Longitude
  - Altitude
  - Satellites
  - Speed
  - AccelX
  - AccelY
  - AccelZ

#### Data Processing
- Parse CSV data and separate into individual waves based on threshold criteria
- Each wave should maintain the standard Firebase format (with the updated coordinate array format from Step 1)
- Required wave data:
  - Average speed
  - Coordinate array (simplified format)
  - Duration
  - End time
  - Start time
  - Top speed

#### Session Creation
- Create a session entity in Firebase based on all parsed waves
- Extract location data from the first coordinate for session metadata
- Format all time data consistently across the application

#### Backward Compatibility
- Maintain ability to create fake sessions
- Ensure fake session data matches the format of real CSV uploads

### Test Data
- Example data available at: `assets/test_data_tafton`

## 3. Dark Mode Implementation

### Feature Description
Add a system-wide dark/light mode toggle to improve user experience.
Do not need to implement into other pages, just need to create the basis to go off of

### Requirements
- Add a toggle button on the settings page
- Connect user preference to Firebase user profile
- Ensure all future added UI components support both dark and light modes
- Set light mode as the default

## 4. Session Detail Page Revamp

### Feature Description
Completely redesign the session detail page UI to match the reference design while maintaining functionality.

### Requirements
#### Layout Changes
- **Map Area**:
  - Maintain similar map size as reference design
  - Remove current top bar
  - Add floating, semi-transparent buttons over the map

#### Button Configuration
- **Left Side**:
  - Back button
- **Right Side**:
  - Filter button (placeholder for future functionality)
  - Share button (placeholder for future functionality)

#### Wave Slider
- Add a horizontal slider below the map, attached to the bottom sheet
- Slider should be semi-transparent and easy to use
- Left position (position 0) should show session summary
- Other positions should show individual waves
- Include left/right navigation arrows
- Add a summary icon button on the far left to quickly return to summary view

#### Bottom Sheet Content
- **For Summary View**:
  - Number of waves (bold, blue text recommended)
  - Top speed
  - Longest ride
  - Total duration
- **For Individual Wave View**:
  - Duration in seconds
  - Top speed
  - Average speed
  - Total distance
- Display appropriate timestamp in top-right corner for each wave and summary

#### Design Notes
- The bottom area where "reactions" appear in the reference should be left blank
- All UI elements must support both light and dark modes

### Reference Designs
- Main reference: `assets/ripcurlSESSIONPAGE`
- Slider reference: `assets/ripcurladdedslider`