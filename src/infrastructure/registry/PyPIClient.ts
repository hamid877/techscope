export interface PyPIDownloadRecord {
  category: string;
  date: string;
  downloads: number;
}

export interface PyPIOverallResponse {
  data: PyPIDownloadRecord[];
  package: string;
  type: string;
}

export class PyPIClient {
  private readonly baseUrl = 'https://pypistats.org/api/packages';

  async getOverallDownloads(packageName: string): Promise<PyPIOverallResponse | null> {
    try {
      // URL encode the package name
      const encodedPackage = encodeURIComponent(packageName);
      const url = `${this.baseUrl}/${encodedPackage}/overall`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data as PyPIOverallResponse;
    } catch {
      return null;
    }
  }
}
