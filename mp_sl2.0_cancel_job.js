/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Wed Apr 29 2026
 * Modified on:          Wed Apr 29 2026 07:49:24
 * SuiteScript Version:  2.0
 * Description:          Suitelet to be called from LPO.PLUS to cancel a job before the driver has accepted it.
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */

define([
	"N/ui/serverWidget",
	"N/email",
	"N/runtime",
	"N/search",
	"N/record",
	"N/http",
	"N/log",
	"N/redirect",
	"N/format",
	"N/https"
], function (
	ui,
	email,
	runtime,
	search,
	record,
	http,
	log,
	redirect,
	format,
	https
) {
	var role = 0;
	var userId = 0;
	var zee = 0;

	var apiHeaders = {};
	apiHeaders["Content-Type"] = "application/json";
	apiHeaders["Accept"] = "application/json";
	apiHeaders["GENERAL-API-KEY"] = "708aa067-d67d-73e6-8967-66786247f5d7";
	// apiHeaders["GENERAL-API-KEY"] = "708aa06d-d67d-43e6-8966-66886247e5d8"; //Staging Environment

	function onRequest(context) {
		var baseURL = "https://system.na2.netsuite.com";
		if (runtime.EnvType == "SANDBOX") {
			baseURL = "https://system.sandbox.netsuite.com";
		}
		userId = runtime.getCurrentUser().id;
		role = runtime.getCurrentUser().role;

		var lpoLeadBDMAssigned = null;

		var date = new Date();
		var date_now = format.parse({
			value: date,
			type: format.Type.DATE
		});
		var time_now = format.parse({
			value: date,
			type: format.Type.TIMEOFDAY
		});

		var zeeName = null;
		var zeeEmail = null;
		var zeePhone = null;

		if (context.request.method === "GET") {
			log.debug({
				title: "context.request.parameters",
				details: context.request.parameters
			});

			//	{"compid":"1048144","job_id":"o6Ncg2sKeAaZW2ntvIg6","lpo_id":"1974139","ns-at":"AAEJ7tMQft1Dl2RVClm4B9TZr9MEKQ4mSl-fhRftfdOXMPsHlRI","customer_id":"1994558","request_id":"zdmymMi0f2vJfkuQi27t","script":"2533","deploy":"1"}

			var lpoHubJobID = context.request.parameters.job_id;
			var lpoHubRequestID = context.request.parameters.request_id;
			var lpoHubCustomerID = context.request.parameters.customer_id;
			var lpoHubLpoID = context.request.parameters.lpo_id;

			//Search Name: LPO.PLUS - Jobs Not Completed
			var lpoPlusJobsNotCompletedSearch = search.load({
				type: "customrecord_jobgroup",
				id: "customsearch_lpo_plus_jobs_not_completed"
			});
			lpoPlusJobsNotCompletedSearch.filters.push(
				search.createFilter({
					name: "custrecord_lpo_hub_job_id",
					join: null,
					operator: search.Operator.IS,
					values: lpoHubJobID
				})
			);
			var oldJobGroupInternalID = null;
			var jobCount = 0;
			lpoPlusJobsNotCompletedSearch.run().each(function (resultSet) {
				var appJobGroupInternalID = resultSet.getValue({
					name: "internalid"
				});
				var appJobInternalID = resultSet.getValue({
					name: "internalid",
					join: "CUSTRECORD_JOB_GROUP"
				});

				var apiURL =
					"https://app.mailplus.com.au/api/v1/general/ns_jobs/cancel?ns_id=" +
					appJobInternalID;
				var apiResponse = https.post({
					url: apiURL,
					body: null,
					headers: apiHeaders
				});

				var parsedAPIResponseBody = JSON.parse(apiResponse.body);

				log.debug({
					title: "API Response Body",
					details: parsedAPIResponseBody
				});
				//Load App Job and change status to cancelled
				var appJobRecord = record.load({
					type: "customrecord_job",
					id: appJobInternalID
				});
				appJobRecord.setValue({
					fieldId: "custrecord_job_status",
					value: 8
				});
				var app_job_id = appJobRecord.save();

				oldJobGroupInternalID = appJobGroupInternalID;
				jobCount++;
				return true;
			});

			if (jobCount > 0) {
				var appJobGroupRecord = record.load({
					type: "customrecord_jobgroup",
					id: oldJobGroupInternalID
				});
				appJobGroupRecord.setValue({
					fieldId: "custrecord_jobgroup_status",
					value: 5
				});
				var app_job_group_id = appJobGroupRecord.save();

				var returnObj = {
					success: true,
					message: "The job has been successfully cancelled."
				};
			} else {
				var returnObj = {
					success: false,
					message: "No jobs were cancelled."
				};
			}

			log.audit({
				title: "Final Return",  
				details: JSON.stringify(returnObj)
			});
			_sendJSResponse(context.request, context.response, returnObj);
		}
	}

	function _sendJSResponse(request, response, respObject) {
		// response.setContentType("JAVASCRIPT");
		// response.setHeader('Access-Control-Allow-Origin', '*');
		var callbackFcn = request.jsoncallback || request.callback;
		if (callbackFcn) {
			response.writeLine({
				output: callbackFcn + "(" + JSON.stringify(respObject) + ");"
			});
		} else response.writeLine({ output: JSON.stringify(respObject) });
	}

	function getDateStoreNS() {
		var date = new Date();
		if (date.getHours() > 6) {
			date.setDate(date.getDate() + 1);
		}

		format.format({
			value: date,
			type: format.Type.DATE,
			timezone: format.Timezone.AUSTRALIA_SYDNEY
		});

		return date;
	}

	function getStateId(state) {
		var state_id;

		switch (state) {
			case "NSW":
				state_id = 1;
				break;
			case "QLD":
				state_id = 2;
				break;
			case "VIC":
				state_id = 3;
				break;
			case "SA":
				state_id = 4;
				break;
			case "TAS":
				state_id = 5;
				break;
			case "ACT":
				state_id = 6;
				break;
			case "WA":
				state_id = 7;
				break;
			case "NT":
				state_id = 8;
				break;
			case "NZ":
				state_id = 9;
				break;
		}

		return state_id;
	}

	function areDatesEqual(dateStr1, dateStr2) {
		// Expects both dates in "YYYY-MM-DD" format
		return dateStr1 === dateStr2;
	}

	/**
	 * @description Function to check if a service exists in the service list.
	 * @author Ankith Ravindran (AR)
	 * @date 17/06/2025
	 * @param {*} data
	 * @param {*} service
	 * @returns {*}
	 */
	function getServiceRate(serviceList, serviceName) {
		// serviceList: array of objects with 'name' and 'rate' properties
		// serviceName: string to check (case-insensitive)
		for (var i = 0; i < serviceList.length; i++) {
			if (serviceList[i].name == serviceName) {
				return { rate: serviceList[i].rate, id: serviceList[i].id };
			}
		}
		return null; // Not found
	}

	function pad(s) {
		return s < 10 ? "0" + s : s;
	}

	function isNullorEmpty(strVal) {
		return (
			strVal == null ||
			strVal == "" ||
			strVal == "null" ||
			strVal == undefined ||
			strVal == "undefined" ||
			strVal == "- None -" ||
			strVal == " "
		);
	}

	function arrayOfStringsToIntegers(arr) {
		var result = [];
		for (var i = 0; i < arr.length; i++) {
			var num = parseInt(arr[i], 10);
			if (!isNaN(num)) {
				result.push(num);
			}
		}
		return result;
	}

	function isArrayAlt(variable) {
		return Array.isArray
			? Array.isArray(variable)
			: Object.prototype.toString.call(variable) === "[object Array]";
	}

	return {
		onRequest: onRequest
	};
});
