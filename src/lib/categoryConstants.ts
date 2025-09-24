// Centralized category constants for consistency across the application
export const PARTICIPANT_CATEGORIES = [
  'Wolf Gold',
  'Wolf Black', 
  'VIP Wolf',
  'Camarote'
] as const;

export type ParticipantCategory = typeof PARTICIPANT_CATEGORIES[number];

export const getCategoryColor = (category: string) => {
  switch (category) {
    case "Wolf Gold":
      return "bg-wolf-gold text-wolf-black";
    case "Wolf Black":
      return "bg-wolf-black text-white";
    case "VIP Wolf":
      return "bg-wolf-vip text-white";
    case "Camarote":
      return "bg-purple-600 text-white";
    default:
      return "bg-muted";
  }
};

export const getCategoryChartColor = (category: string) => {
  switch (category) {
    case "Wolf Gold":
      return "#FFA500";
    case "Wolf Black":
      return "#262626";
    case "VIP Wolf":
      return "#B347E6";
    case "Camarote":
      return "#9333EA";
    default:
      return "#8884d8";
  }
};