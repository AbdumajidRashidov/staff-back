/**
 * computer controller
 */

import { factories } from '@strapi/strapi'
import {customError, customSuccess} from "../../../utils/app-response";
import { checkRequiredCredentials } from "../../../utils/credentials";
import jwt from 'jsonwebtoken';

export default factories.createCoreController('api::computer.computer', ({ strapi }): {} => ({
  async clientCreate(ctx: any) {
    try {
      const { PCID, UserID, PCName, HostName, GivenName, SureName, InDomain, Mac, IP, OS, Version, UserName } = ctx.request.body

      const credentialsMap = new Map(
        [
          ['PCID', PCID],
          ['UserId', UserID],
          ['PCName', PCName],
          ['HostName', HostName],
          // ['GivenName', GivenName],
          ['UserName', UserName],
          // ['SureName', SureName],
          // ['InDomain', InDomain],
          ['Mac', Mac],
          ['IP', IP],
          // ['OS', OS],
          ['Version', Version],
        ]
      )

      if (typeof InDomain !== 'boolean') return await customError(ctx, 'InDomain must be boolean', 400)

      const checkRC = checkRequiredCredentials(credentialsMap)
      if (!checkRC[0]) {
        return await customError(ctx, checkRC[1], 400)
      }

      const [ employee ] = await strapi.entityService.findMany('api::employee.employee', {
        filters: {user: UserID}
      });

      const [ computer ] = await strapi.entityService.findMany('api::computer.computer', {
        filters: {pcId: PCID}
      });

      let _employee
      let _computer
      let isUpdated

      const dataEmployee = {
        firstName: GivenName,
        lastName: SureName || '',
        hostname: HostName,
        inDomain: InDomain,
        UserName: UserName,
      }

      if (employee) {
        const _token = jwt.sign({ id: employee.id }, strapi.config.get('plugin.users-permissions.jwtSecret'));
        _employee = await strapi.entityService.update('api::employee.employee', employee.id, {
          data: {
            ...dataEmployee,
            token: _token
          },
        });
        isUpdated = true
      } else {
        _employee = await strapi.entityService.create('api::employee.employee', {
          data: dataEmployee
        })
        const _token = jwt.sign({ id: _employee.id }, strapi.config.get('plugin.users-permissions.jwtSecret'));
        _employee = await strapi.entityService.update('api::employee.employee', _employee.id, {
          data: { token: _token }
        })
      }

      const dataComputer = {
        ip: IP,
        os: OS,
        mac: Mac,
        agentVersion: Version,
        pcName: PCName
      }
      if (computer) {
        _computer = await strapi.entityService.update('api::computer.computer', computer.id, {
          data: dataComputer
        })
      } else {
        _computer = await strapi.entityService.create('api::computer.computer', {
          data: {
            ...dataComputer,
            pcId: PCID
          }
        })
      }
      _employee = await strapi.entityService.update('api::employee.employee', _employee.id, {
        data: { computer: _computer.id }
      })

      const message = isUpdated ? 'Employee and Computer updated successfully' : 'Employee and Computer created successfully'
      const modules = 'activeWindow,webSniffer,keylogger,screenshot'
      const token = _employee.token
      return await customSuccess(ctx, { message, token, modules })
    } catch (err) {
      strapi.log.error("error in function clientCreate, error: ", err)
      return await customError(ctx, 'internal server error', 500)
    }
  }
}));
