/** Practice URLs. The topic is in the path so the page can link related lessons without the attempt cookie. */
export function practiceSessionPath(topicId: string, attemptId: string) {
  return `/testove/${topicId}/${attemptId}`;
}

export function practiceTopicAnchor(topicId: string) {
  return `/testove#tema-${topicId}`;
}
