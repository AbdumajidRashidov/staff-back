type ErrorNames = {
  [key: number]: string
}
const errorNames: ErrorNames = { 404: 'NotFound', 403: 'Forbidden', 401: 'Unauthorized', 400: 'BadRequest', 500: 'Internal', 409: 'Conflict' }

export async function customError(ctx, msg, statusCode) {
  return await ctx.send({
    data: null,
    success: false,
    error: {
      status: statusCode,
      name: errorNames[statusCode],
      message: msg,
      details: {}
    }
  }, statusCode)
}
export async function customSuccess(ctx, data) {
  return await ctx.send({
    data: data,
    success: true,
    error: null,
  }, 200)
}

