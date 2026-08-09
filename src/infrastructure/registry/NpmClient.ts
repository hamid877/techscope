export interface NpmDownloadResponse {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

export class NpmClient {
  private readonly baseUrl = 'https://api.npmjs.org/downloads/point';

  async getDownloads(period: string, packageName: string): Promise<NpmDownloadResponse | null> {
    try {
      // Scoped packages like @babel/core must be properly encoded for the npm API
      // e.g., @babel/core -> %40babel/core
      const encodedPackage = encodeURIComponent(packageName);
      const url = `${this.baseUrl}/${period}/${encodedPackage}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data as NpmDownloadResponse;
    } catch {
      return null;
    }
  }
}
