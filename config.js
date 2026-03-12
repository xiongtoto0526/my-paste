window.APP_CONFIG = {
  quickActions: {
    openProject: {
      enabled: true,
      label: '打开项目',
      path: '/Users/xmaster/Documents/code/vibe/my-paste'
    }
  },
  sort: {
    pinnedDomains: ['localhost:5100', 'localhost:5200']
  },
  filter: {
    hiddenDomains: ['sina.cn','chat.baidu.com','news.sina.cn']
  },
  tags: {
    domainTags: {
      'localhost:5100': { text: 'API', color: 'blue' },
      'localhost:5200': { text: 'CMS API', color: 'purple' }
    }
  },
  aiRadar: {
    enabled: true,
    intervalMinutes: 30,
    sources: [
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        type: 'rss',
        feedUrl: 'https://github.blog/changelog/label/copilot/feed/',
        pageUrl: 'https://github.blog/changelog/label/copilot',
        enabled: true
      },
      {
        id: 'cursor',
        name: 'Cursor',
        type: 'rss',
        feedUrl: '',
        enabled: false
      },
      {
        id: 'claude',
        name: 'Claude AI',
        type: 'rss',
        feedUrl: '',
        enabled: false
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        type: 'html',
        pageUrl: 'https://ai.google.dev/gemini-api/docs/changelog',
        enabled: true
      }
    ]
  }
}
