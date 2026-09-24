export interface ReleaseNoteSections {
  features: readonly string[];
  improvements: readonly string[];
  fixes: readonly string[];
}

export interface LocalizedReleaseNotes {
  version: string;
  releaseDate: string;
  sections: ReleaseNoteSections;
}
