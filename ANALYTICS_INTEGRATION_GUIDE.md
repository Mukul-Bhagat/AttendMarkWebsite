# Individual Analytics - Integration Guide

## ✅ All Components Created!

**Location:** `AttendMarkWebsite-main/src/`

---

## 📁 Components Created:

### **1. API Functions**
- ✅ `api/analyticsApi.ts` - API functions for analytics

### **2. Filter Component**
- ✅ `components/attendance/AnalyticsFilters.tsx` - Session & date selection

### **3. Chart Components**
- ✅ `components/charts/AttendanceTrendChart.tsx` - Line chart
- ✅ `components/charts/OverallStatusDonut.tsx` - Donut chart

### **4. Tab Components**
- ✅ `components/attendance/AnalyticsTab.tsx` - Analytics view
- ✅ `components/attendance/AttendanceReportTab.tsx` - Table view

---

## 🔧 Integration Steps

### **Step 1: Install Dependencies (if not already installed)**

```bash
cd AttendMarkWebsite-main
npm install recharts
```

### **Step 2: Add to MyAttendance.tsx**

Add these imports at the top of `MyAttendance.tsx`:

```typescript
// Add these imports after existing imports
import { getMyAnalytics, getMySessions } from '../api/analyticsApi';
import AnalyticsFilters from '../components/attendance/AnalyticsFilters';
import AnalyticsTab from '../components/attendance/AnalyticsTab';
import AttendanceReportTab from '../components/attendance/AttendanceReportTab';
import { BarChart3, Table } from 'lucide-react';
```

### **Step 3: Add State Variables**

Add these state variables inside the `MyAttendance` component:

```typescript
// Analytics state
const [sessions, setSessions] = useState<any[]>([]);
const [selectedSession, setSelectedSession] = useState('');
const [analyticsStartDate, setAnalyticsStartDate] = useState('');
const [analyticsEndDate, setAnalyticsEndDate] = useState('');
const [analyticsData, setAnalyticsData] = useState<any>(null);
const [analyticsLoading, setAnalyticsLoading] = useState(false);
const [activeTab, setActiveTab] = useState<'analytics' | 'report'>('analytics');
```

### **Step 4: Add useEffect to Fetch Sessions**

Add this useEffect hook:

```typescript
// Fetch user's sessions on mount
useEffect(() => {
  const fetchSessions = async () => {
    try {
      const response = await getMySessions();
      if (response.success) {
        setSessions(response.data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };
  fetchSessions();
}, []);
```

### **Step 5: Add Analytics Fetch Function**

Add this function:

```typescript
// Handle view analytics report
const handleViewAnalytics = async () => {
  if (!analyticsStartDate || !analyticsEndDate) {
    toast.error('Please select both start and end dates');
    return;
  }

  setAnalyticsLoading(true);
  try {
    const response = await getMyAnalytics({
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
      sessionId: selectedSession || undefined,
    });

    if (response.success) {
      setAnalyticsData(response.data);
      toast.success('Analytics loaded successfully');
    }
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    toast.error(error.response?.data?.error || 'Failed to load analytics');
  } finally {
    setAnalyticsLoading(false);
  }
};
```

### **Step 6: Add JSX to Render**

In the return statement of `MyAttendance`, add this section AFTER the summary cards (Total Records, Verified, Not Verified):

```tsx
{/* Analytics Section */}
<div className="mt-8">
  {/* Filters */}
  <AnalyticsFilters
    sessions={sessions}
    selectedSession={selectedSession}
    startDate={analyticsStartDate}
    endDate={analyticsEndDate}
    onSessionChange={setSelectedSession}
    onStartDateChange={setAnalyticsStartDate}
    onEndDateChange={setAnalyticsEndDate}
    onViewReport={handleViewAnalytics}
    loading={analyticsLoading}
  />

  {/* Tab Navigation */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
    <div className="flex border-b border-gray-200">
      <button
        onClick={() => setActiveTab('analytics')}
        className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
          activeTab === 'analytics'
            ? 'text-orange-600 border-b-2 border-orange-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <BarChart3 className="w-5 h-5" />
        Analytics
      </button>
      <button
        onClick={() => setActiveTab('report')}
        className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
          activeTab === 'report'
            ? 'text-orange-600 border-b-2 border-orange-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Table className="w-5 h-5" />
        Attendance Report
      </button>
    </div>
  </div>

  {/* Tab Content */}
  {activeTab === 'analytics' ? (
    <AnalyticsTab analyticsData={analyticsData} loading={analyticsLoading} />
  ) : (
    <AttendanceReportTab 
      records={analyticsData?.records || []} 
      loading={analyticsLoading} 
    />
  )}
</div>
```

---

## 📍 Where to Add in MyAttendance.tsx

Find this section (around line 500-800):

```tsx
{/* Summary Cards */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  {/* Total Records Card */}
  {/* Verified Card */}
  {/* Not Verified Card */}
</div>
```

**Add the Analytics Section JSX RIGHT AFTER the closing `</div>` of the summary cards grid.**

---

## 🎯 Expected Result

After integration, the page will have:

1. **Top Section** (Unchanged):
   - Total Records card
   - Verified card
   - Not Verified card

2. **New Analytics Section**:
   - Filter dropdowns (Class, Start Date, End Date, View Report button)
   - Tab navigation (Analytics | Attendance Report)
   - Analytics Tab:
     - Line chart showing trend
     - Donut chart showing status breakdown
     - Performance summary
   - Attendance Report Tab:
     - Table with Date, Session, Status, Check-in Time
     - Pagination
     - Status badges

---

## 🧪 Testing

1. **Navigate to**: http://localhost:5173/my-attendance
2. **Select**:
   - Class/Batch (optional)
   - Start Date (e.g., 2026-01-01)
   - End Date (e.g., 2026-01-31)
3. **Click**: "View Report"
4. **Check**:
   - ✅ Analytics tab shows charts
   - ✅ Attendance Report tab shows table
   - ✅ Data is accurate
   - ✅ Tab switching works

---

## 🔍 Troubleshooting

### **Issue: "recharts is not defined"**
**Solution:**
```bash
npm install recharts
```

### **Issue: Analytics not loading**
**Check:**
1. Backend is running (`npm run dev` in backend folder)
2. Check browser console for errors
3. Check network tab for API call status
4. Verify authentication token exists

### **Issue: Empty charts**
**Check:**
1. Selected date range has attendance records
2. User has attendance data in the selected period
3. Backend API is returning data (check Network tab)

---

## 📊 Features

### **Filters:**
- ✅ Dropdown to select class/session
- ✅ Date pickers for range selection
- ✅ "All Sessions" option
- ✅ Loading state

### **Analytics Tab:**
- ✅ Line chart (attendance trend over time)
- ✅ Donut chart (status breakdown)
- ✅ Interactive tooltips
- ✅ Color-coded status (Green=Present, Red=Absent, Yellow=Late, Blue=Leave)
- ✅ Summary statistics cards
- ✅ Responsive design

### **Attendance Report Tab:**
- ✅ Sortable table
- ✅ Pagination (10 records per page)
- ✅ Status badges with icons
- ✅ Verification indicator
- ✅ Session name display
- ✅ Check-in time

---

## 🎨 Styling

All components use:
- ✅ Tailwind CSS
- ✅ Orange color scheme (matching app theme)
- ✅ Lucide icons
- ✅ Responsive design
- ✅ Smooth animations

---

## 🚀 Next Steps

1. **Install recharts** (if needed)
2. **Copy code** from Step 2-6 to MyAttendance.tsx
3. **Test** the feature
4. **Adjust** styling if needed
5. **Deploy** and enjoy! 🎉

---

**All components are ready! Just follow the integration steps above.** 💪
