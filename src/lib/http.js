// Helpers shared by the API route handlers: JSON responses, input
// checks, and turning database errors into clear HTTP responses.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

// PostgreSQL error codes and the HTTP status each one maps to
const DB_ERRORS = {
  '23505': [409, 'This record already exists'],                      // unique_violation
  '23503': [409, 'This refers to a record that does not exist or is still in use'], // foreign_key_violation
  '23514': [400, 'The data breaks a database rule'],                  // check_violation (CHECK or trigger)
  '23502': [400, 'A required value is missing'],                      // not_null_violation
  '22P02': [400, 'A value has the wrong format'],                     // invalid_text_representation
  '22007': [400, 'A date has the wrong format'],                      // invalid_datetime_format
  '22008': [400, 'A date is out of range'],                           // datetime_field_overflow
  '22003': [400, 'A number is out of range'],                         // numeric_value_out_of_range
  '22001': [400, 'A value is too long'],                              // string_data_right_truncation
  '42501': [403, 'The database does not allow your role to do this'], // insufficient_privilege
};

export function errorResponse(err) {
  if (err instanceof HttpError) {
    return json({ error: err.message }, err.status);
  }
  const known = DB_ERRORS[err?.code];
  if (known) {
    const [status, summary] = known;
    return json({ error: summary, detail: err.message, code: err.code }, status);
  }
  console.error(err);
  return json({ error: 'Something went wrong on the server' }, 500);
}

// Wraps a route handler so any thrown error becomes a JSON response
export function route(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(request) {
  try {
    const body = await request.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'The request body must be a JSON object');
  }
}

// ---------------------------------------------------------------------
// Input checks (the database checks the rest with its constraints)
// ---------------------------------------------------------------------
export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length > 0) {
    throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}

export function toId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} must be a positive whole number`);
  return n;
}

export function optionalInt(value, name, { min = 1, max = 3650 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${name} must be a whole number from ${min} to ${max}`);
  }
  return n;
}

export async function paramId(context, name = 'id') {
  const params = await context.params;
  return toId(params[name], name);
}
