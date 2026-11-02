export const beraflixColors = {
  background: "#08090D",
  surface: "#101116",
  elevated: "#171820",
  border: "#272932",
  red: "#F01436",
  redDeep: "#B50929",
  white: "#FFFFFF",
  text: "#F3F3F6",
  muted: "#9295A0",
  quiet: "#626570",
  black: "#050507",
} as const;

export const exploreModes = [
  { id: "movies", label: "Movies" },
  { id: "series", label: "Series" },
  { id: "anime", label: "Anime" },
  { id: "sports", label: "Sports" },
  { id: "channels", label: "TV Channels" },
  { id: "books", label: "Books" },
  { id: "wrestling", label: "Wrestling" },
] as const;

export type ExploreMode = (typeof exploreModes)[number]["id"];

export const shelfSections = [
  "Continue",
  "Watchlist",
  "Favorites",
  "Liked",
  "Watched",
  "History",
  "Collections",
] as const;

export type ShelfSection = (typeof shelfSections)[number];
