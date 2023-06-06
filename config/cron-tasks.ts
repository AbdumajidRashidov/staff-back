import {Employee} from "../src/api/employee/dto/employee";
import moment from "moment";
import {customError} from "../src/utils/app-response";

export default {
  /**
   * Simple example.
   * Every monday at 1am.
   */

  addAllEmployee: {
    task: async ({ strapi }) => {
      try {
        strapi.log.info("Running cron task: addAllEmployee");
        const allEmployees: [Employee] = await strapi.entityService.findMany("api::employee.employee", {
          populate: [
            'company',
          ]
        });
        const [ mainAttendanceStatus ] = await strapi.entityService.findMany("api::attendance-status.attendance-status", {
          filters: {
            isMain: true
          }
        });

        const [ company ] = await strapi.entityService.findMany("api::company.company", {});
        const companyWorkStartTime: string = company.workStartTime.split('T')[1];
        const companyWorkEndTime: string = company.workEndTime.split('T')[1];
        const currentDate: Date = new Date();
        const currentDateOnly = currentDate.toISOString().split('T')[0];
        const currentDay: number = moment(currentDate).get('date');
        const currentMonth: number = moment(currentDate).get('month') + 1; // .get('month) is zero-based
        const currentYear: number = moment(currentDate).get('year');
        const dateToNumber: number = currentYear + (currentMonth * 2023) + currentDay

        for (const employee of allEmployees) {
          await strapi.entityService.create('api::attendance.attendance', {
            data: {
              employee: employee.id,
              company: employee.company.id,
              today: currentDate.toISOString().split('T')[0], // YYYY-MM-DD
              todayInNumber: dateToNumber,
              firstIn: `${currentDateOnly}T${companyWorkStartTime}`,
              lastOut: `${currentDateOnly}T${companyWorkEndTime}`,
              isAbsent: true,
              absenceStatus: mainAttendanceStatus ? mainAttendanceStatus.id : null,
            }
          })
        }
        strapi.log.info("Finished running cron task: addAllEmployee");
      } catch (err) {
        strapi.log.error('Error while running addAllEmployee cron task: ', err);
      }
    },
    options: {
      rule: "0 5 0 * * *",
    },
  },
};
