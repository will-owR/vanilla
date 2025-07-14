export function getApiBaseUrl() {
  // Get the current hostname from the window location
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // Check if we're running in GitHub Codespaces
  if (hostname.endsWith('.app.github.dev')) {
    // Replace the port number in the Codespaces URL
    return `https://${hostname.replace(/3000/, '5000')}`;
  }
  
  // Use environment variable if set, otherwise default to local development URL
  return process.env.NEXT_PUBLIC_API_URL || 'https://localhost:5000';
}

const API_BASE_URL = getApiBaseUrl();

interface Calendar {
  id: string;
  year: number;
  selectedMonths: string[];
  events: Array<{ date: string; title: string }>;
  backgroundUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createCalendar(
  data: Omit<Calendar, "id" | "createdAt" | "updatedAt">
) {
  const response = await fetch(`${API_BASE_URL}/calendar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create calendar");
  }

  return response.json();
}

export async function getCalendars() {
  const response = await fetch(`${API_BASE_URL}/calendar`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch calendars");
  }

  return response.json();
}

export async function getCalendar(id: string) {
  const response = await fetch(`${API_BASE_URL}/calendar?id=${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch calendar");
  }

  return response.json();
}

export async function updateCalendar(
  id: string,
  data: Partial<Omit<Calendar, "id" | "createdAt" | "updatedAt">>
) {
  const response = await fetch(`${API_BASE_URL}/calendar/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update calendar");
  }

  return response.json();
}

export async function deleteCalendar(id: string) {
  const response = await fetch(`${API_BASE_URL}/calendar/${id}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete calendar");
  }

  return true;
}
