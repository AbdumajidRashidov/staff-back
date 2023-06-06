/**
 * active-window controller
 */

import { factories } from '@strapi/strapi'
import {customError, customSuccess} from "../../../utils/app-response";

export default factories.createCoreController('api::active-window.active-window', ({strapi}) => ({
  async activeWindow (ctx) {
    // try {
    //
    // } catch (err) {
    //   strapi.log.error("error in function activeWindow, error: ", err)
    //   return await customError(ctx, 'internal server error', 500)
    // }
    // const { authorization } = ctx.request.headers
    // // const _token = await parseJwt(authorization, ctx)
    // // if (!_token) return await customError(ctx, 'token is invalid', 401)
    // const employee = await strapi.entityService.findOne('api::employee.employee', _token.id, {
    //   populate: '*'
    // });
    //
    // if (!employee) return customError(ctx, 'Employee is not found. Check your token')
    // const _body = ctx.request.body
    //
    // if (!lodash.isArray(_body))return customError(ctx, 'Body is not array')
    //
    // for await (const item of _body) {
    //   const { Icon, DateTime, Title, Process, ActiveTime } = item
    //
    //   if (!Icon) return customError(ctx, 'Icon is required')
    //   if (!DateTime) return customError(ctx, 'DateTime is required')
    //   if (!Title) return customError(ctx, 'Title is required')
    //   if (!Process) return customError(ctx, 'Process is required')
    //   if (!ActiveTime) return customError(ctx, 'ActiveTime is required')
    // }
    // for await (const item of _body) {
    //   const { Icon, DateTime, Title, Process, ActiveTime } = item
    //   const _data = {
    //     dateTime: DateTime,
    //     employee: _token.id,
    //     title: Title,
    //     time: ActiveTime,
    //     process: Process,
    //     icon: await uploader(Icon)
    //   }
    //
    //   await strapi.entityService.create('api::activewindow.activewindow', {
    //     data: _data
    //   });
    // }
    //
    // return {
    //   success: true,
    //   message: 'Activewindows created successfully',
    //   modules: 'activewindow,websniffer,keylogger,screenshot'
    // }
  }
}));
