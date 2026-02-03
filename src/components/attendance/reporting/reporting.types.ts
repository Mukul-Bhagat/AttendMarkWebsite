export interface ShareForm {
    recipientName: string;
    recipientEmail: string;
    recipientGender: 'Male' | 'Female' | 'Other';
    recipientRole: 'TPO' | 'HOD' | 'HR' | 'OTHER';
    hasSecondRecipient: boolean;
    recipient2Name: string;
    recipient2Email: string;
    recipient2Gender: 'Male' | 'Female' | 'Other';
    recipient2Role: 'TPO' | 'HOD' | 'HR' | 'OTHER';
    organizationName: string;
    organizationLogo: string;
    startDate: string;
    endDate: string;
    automateWeekly: boolean;
    preferredWeekday: string;
    preferredTime: string;
    automateMonthly: boolean;
    monthlySchedule: string;
    monthlyTime: string;
}

export interface DownloadForm {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    organizationName: string;
    organizationLogo: string;
    reportType: 'ALL' | 'PRESENT' | 'ABSENT';
}
