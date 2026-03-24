self.EZMessaging = {
  makeMessage(type, payload = {}, sender = 'unknown') {
    return {
      type,
      payload,
      sender,
      requestId: crypto.randomUUID()
    };
  },

  makeResponse(ok, payload = {}, requestId, error) {
    return {
      ok,
      payload,
      error,
      requestId
    };
  }
};
