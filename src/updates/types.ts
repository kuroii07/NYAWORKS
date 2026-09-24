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

export interface ReleaseInfo {
  tagName: string;
  title: string;
  body: string;
  htmlUrl: string;
  prerelease: boolean;
}
