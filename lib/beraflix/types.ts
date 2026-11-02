export type CatalogTitle = {
  id: string;
  title: string;
  genre: string;
  description: string;
  releaseDate: string;
  duration: number;
  rating: string;
  coverUrl: string | null;
  backdropUrl: string | null;
  detailPath: string;
  type: string;
  section: string;
  hasResource: boolean;
};

export type HomeFeed = {
  items: CatalogTitle[];
  sections: string[];
};

export type ChannelRecord = {
  id: string;
  name: string;
  country: string;
  languages: string[];
  isGeoBlocked: boolean;
  streamType: string;
};

export type ChannelStream = {
  kind: "hls" | "embed";
  url: string;
  name: string;
  expiresAt: string | null;
};

export type CountryRecord = {
  code: string;
  name: string;
  channelCount: number;
  timeZone: string;
};

export type ScheduleProgram = {
  id: string;
  title: string;
  description: string;
  slogan: string;
  status: string;
  startTime: string;
  endTime: string;
  schedule: string;
  presenters: string[];
};

export type ExploreContent = {
  id: string;
  title: string;
  description: string;
  subtitle: string;
  coverUrl: string | null;
  detailPath?: string;
  kind: "catalog" | "novel" | "sports" | "wrestling";
};
