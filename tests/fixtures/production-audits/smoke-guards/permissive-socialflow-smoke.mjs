const checks = [
  {
    path: "/api/socialflow/profile",
    expectedStatuses: [200, 401, 403, 405],
  },
  {
    path: "/api/socialflow/campaigns?saasId=socialflow",
    expectedStatuses: [200, 401, 403, 405],
  },
  {
    path: "/api/socialflow/posts?saasId=socialflow",
    expectedStatuses: [200, 401, 403, 405],
  },
  {
    path: "/api/social/posts",
    expectedStatuses: [200, 410],
  },
  {
    path: "/api/social/linkedin/publish",
    expectedStatuses: [200, 410],
  },
];
