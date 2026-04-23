/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript

 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 21 2026
 * Modified on:          Tue Apr 21 2026 15:27:02
 * SuiteScript Version:  2.0 
 * Description:          Schedule script to go through the Firebase Firestore DB and filter the jobs for tomorrow and create scheduled jobs in NetSuite for those jobs with the relevant details. 
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */


define(['N/task', 'N/email', 'N/runtime', 'N/search', 'N/record', 'N/format',
    'N/https'
],
    function (task, email, runtime, search, record, format, https) {

        function execute(context) {

            tomorrowDateYYYYMMDD = getTomorrowsDate();
            log.audit({
                title: 'Tomorrow Date',
                details: tomorrowDateYYYYMMDD
            });

            //GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
            var tokenBody = '{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}'

            var apiHeaders = {};
            apiHeaders["Content-Type"] = "application/json";

            var responseAccessToken = https.request({
                method: https.Method.POST,
                url: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs',
                headers: apiHeaders,
                body: tokenBody
            });

            log.debug({
                title: 'Firebase Access Token Response',
                details: responseAccessToken.body
            });

            var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

            var idToken = responseAccessTokenObj.idToken;
            // idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
            var refreshToken = responseAccessTokenObj.refreshToken;

            var firebaseLeadURL =
                'https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents:runQuery';

            var apiHeaders = {};
            apiHeaders["Content-Type"] = "application/json";
            apiHeaders["Accept"] = '*/*';
            apiHeaders["Authorization"] = "Bearer " + idToken;

            var jobQuery = {
                "structuredQuery": {
                    "from": [{ "collectionId": "jobs" }],
                    "where": {
                        "fieldFilter": {
                            "field": { "fieldPath": "date" },
                            "op": "EQUAL",
                            "value": { "stringValue": "" + tomorrowDateYYYYMMDD + "" }
                        }
                    }
                }
            }

            var responseTomorrowsJobs = https.request({
                method: https.Method.POST,
                url: firebaseLeadURL,
                headers: apiHeaders,
                body: JSON.stringify(jobQuery)
            });

            var dbBody = responseTomorrowsJobs.body;
            log.audit({
                title: 'Lead Firebase Data',
                details: dbBody
            })
            var responseObj = JSON.parse(dbBody);

            log.audit({
                title: 'Number of Jobs',
                details: responseObj.length
            });

            //loop through the jobs
            for (var i = 0; i < responseObj.length; i++) {
                var job = responseObj[i].document.fields;

                var jobId = job.jobId.stringValue;
                var jobType = job.jobType.stringValue;
                var lpo_id = job.lpo_id.stringValue;
                var service = job.service.stringValue;
                var customerId = job.customer.netsuiteId.stringValue;

            }

        }
        return {
            execute: execute
        };

        /**
         * @description Gets yesterday's date in "YYYY-MM-DD" format.
         * @returns {String} Yesterday's date in "YYYY-MM-DD" format.
         */
        function getTomorrowsDate() {
            var today = new Date();
            today.setHours(today.getHours() + 10);
            // var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            log.audit({
                title: 'today',
                details: today
            })
            log.audit({
                title: 'today.getDate()',
                details: today.getDate()
            })

            var year = today.getFullYear();
            var month = customPadStart((today.getMonth() + 1).toString(), 2, "0"); // Months are zero-based
            var day = customPadStart((today.getDate() + 1), 2, "0");

            return year + "-" + month + "-" + day;
        }


        /**
         * Is Null or Empty.
         *
         * @param {Object} strVal
         */
        function isNullorEmpty(strVal) {
            return (strVal == null || strVal == '' || strVal == 'null' || strVal ==
                undefined || strVal == 'undefined' || strVal == '- None -');
        }
    });