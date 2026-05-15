function maskTokenInString(value: string) {
  return value.replace(/([?&]token=)[^&]+/gi, '$1***');
}

function sanitizeLogValue(value: any): any {
  if (typeof value === 'string') {
    return maskTokenInString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (value && typeof value === 'object') {
    const nextValue: Record<string, any> = {};

    for (const [key, item] of Object.entries(value)) {
      nextValue[key] =
        key.toLowerCase().includes('token') || key === 'authorization'
          ? '***'
          : sanitizeLogValue(item);
    }

    return nextValue;
  }

  return value;
}

export function logAITaskEvent(event: string, payload?: Record<string, any>) {
  console.log(
    JSON.stringify({
      scope: 'ai-task',
      event,
      ...sanitizeLogValue(payload || {}),
    })
  );
}
