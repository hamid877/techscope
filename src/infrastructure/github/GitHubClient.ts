export class GitHubClient {
  private readonly baseUrl = 'https://api.github.com';

  constructor(private readonly token?: string) {
    if (!this.token && process.env.GITHUB_TOKEN) {
      this.token = process.env.GITHUB_TOKEN;
    }
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TechScope-V1'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options?: RequestInit, retryCount = 0): Promise<{ status: number; data: T | null; headers: Headers; isRateLimited: boolean }> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

const response = await fetch(url, {
  ...options,
  headers: {
    ...this.getHeaders(),
    ...options?.headers
  }
});

console.log('[GitHub]', {
  endpoint,
  status: response.status,
  hasToken: Boolean(this.token),
  rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
  rateLimitLimit: response.headers.get('x-ratelimit-limit'),
});

if (response.status === 202) {
  if (retryCount < 5) {
    // Retry after backoff: 1s, 2s, 4s, 8s, 16s
    await new Promise(resolve =>
      setTimeout(resolve, 1000 * Math.pow(2, retryCount))
    );
    return this.request<T>(endpoint, options, retryCount + 1);
  }
}

    let data: T | null = null;
    if (response.ok && response.status !== 204 && response.status !== 202) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = (await response.json()) as T;
      }
    }

    const isRateLimited = response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0';

    return {
      status: response.status,
      data,
      headers: response.headers,
      isRateLimited
    };
  }

  async paginate<T>(endpoint: string): Promise<{ status: number; data: T[]; isRateLimited: boolean }> {
    let results: T[] = [];
    let nextUrl: string | null = endpoint;

    while (nextUrl) {
      const { status, data, headers, isRateLimited } = await this.request<T[]>(nextUrl);
      
      if (status !== 200 || !data) {
        // Propagate failure and discard partial results
        return { status, data: [], isRateLimited };
      }
      
      results = results.concat(data);

      const linkHeader = headers.get('link');
      nextUrl = this.extractNextLink(linkHeader);
    }

    return { status: 200, data: results, isRateLimited: false };
  }

  private extractNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const links = linkHeader.split(', ');
    for (const link of links) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }
}
