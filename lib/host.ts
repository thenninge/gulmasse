export function assertHost(request: Request) {
  const configured = process.env.HOST_PIN || '0808';
  const header = request.headers.get('x-host-pin') || '';
  if (header !== configured) {
    const err = new Error('Unauthorized');
    // @ts-expect-error add marker
    err.status = 401;
    throw err;
  }
}


