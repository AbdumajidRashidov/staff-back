/**
 * translation controller
 */

import {factories} from '@strapi/strapi'

export default factories.createCoreController('api::translation.translation', ({ strapi }) => ({
  async getByLang (ctx) {
    const _params = {...ctx.params}
    const { lang } = _params
    const entries = await strapi.entityService.findMany('api::translation.translation', {});
    return entries.reduce((a, v) => ({ ...a, [v.key]: v[lang]}), {})
  },
  async setLang (ctx) {
    const _body = {...ctx.request.body}
    const key = Object.keys(_body)[0]
    const value = Object.values(_body)[0]
    return await strapi.entityService.create('api::translation.translation', {
      data: {
        key: key,
        uz: value,
        en: value,
        ru: value
      }
    })
  }
}));
