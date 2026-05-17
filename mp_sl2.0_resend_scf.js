/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * Author:               Ankith Ravindran
 * Created on:           Tue May 12 2026
 * Modified on:          Tue May 12 2026 08:33:04
 * SuiteScript Version:  2.0
 * Description:          Suitelet API to be called from LPO.PLUS so that the LPO's can resend the SCF to the end customer for them to accept the T&C's.
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
	"N/https",
	"N/crypto",
	"N/encode",
	"N/url"
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
	https,
	crypto,
	encode,
	url
) {
	var role = 0;
	var userId = 0;
	var zeeId;
	var zeeCount = 0;

	var todayDateYYYYMMDD = null;
	var tomorrowDateYYYYMMDD = null;

	var apiHeaders = {};
	apiHeaders["Content-Type"] = "application/json";
	apiHeaders["Accept"] = "application/json";
	apiHeaders["GENERAL-API-KEY"] = "708aa067-d67d-73e6-8967-66786247f5d7";

	var lpoParentLPOSubCaustomerforAdhocBookingInternalId = null;
	var lpoParentLPOCustomerInternalID = null;
	var adhocBookingURL = null;
	var lpoLeadProfileInternalId = null;

	var lpoAddress1 = null;
	var lpoAddress2 = null;
	var lpoCity = null;
	var lpoState = null;
	var lpoZip = null;
	var lpoContactName = null;
	var lpoContactEmail = null;
	var lpoContactPhone = null;

	var date = new Date();
	var date_now = format.parse({
		value: date,
		type: format.Type.DATE
	});
	var time_now = format.parse({
		value: date,
		type: format.Type.TIMEOFDAY
	});

	function onRequest(context) {
		var baseURL = "https://system.na2.netsuite.com";
		if (runtime.EnvType == "SANDBOX") {
			baseURL = "https://system.sandbox.netsuite.com";
		}
		userId = 1822062;
		role = 1005;
		var invoicingMethod = [
			"Full Payment Customer",
			"Split Payment LPO & Customer",
			"Full Payment LPO"
		];
		// todayDateYYYYMMDD = getTodaysDate();
		// tomorrowDateYYYYMMDD = getTomorrowsDate();

		if (context.request.method === "GET") {
			log.audit({
				title: "Received Request",
				details: JSON.stringify(context.request)
			});
			log.audit({
				title: "Received Parameters",
				details: JSON.stringify(context.request.parameters)
			});

			//{"lastName":"Ravindran","address":"1 Kingfield Road","lng":"150.9582444","lpo_id":"1974139","postcode":"2155","script":"2527","deploy":"1","billing":"lpo","frequency":"Mon,Wed,Thu,Fri,Tue","firstName":"Ankith","preferredTime":"14:30","compid":"1048144","phone":"0402712233","service":"lpo-to-site","ns-at":"AAEJ7tMQJX8dMLsjS5TGMacB9-M8pUB6q50I_ptxbLYqKZ_HR3c","suburb":"North Kellyville","company":"Bruce Wayne","state":"NSW","jobType":"scheduled","email":"ankith.ravindran@gmail.com","lat":"-33.691453","startDate":"2026-04-21"}

			var parentLPOInternalId = context.request.parameters.lpo_id;
			var customerInternalId = context.request.parameters.customer_id;

			//NetSuite Search: Commencement Register List - To Update T&C's Agreed Date
			var commRegUpdateTnCAgreedDateSearch = search.load({
				id: "customsearch_comm_reg_upd_tnc_date",
				type: "customrecord_commencement_register"
			});

			commRegUpdateTnCAgreedDateSearch.filters.push(
				search.createFilter({
					name: "internalid",
					join: "custrecord_customer",
					operator: search.Operator.ANYOF,
					values: parseInt(customerInternalId)
				})
			);

			var commRegInternalId = null;
			commRegUpdateTnCAgreedDateSearch
				.run()
				.each(function (commRegUpdateTnCAgreedDateSearchResult) {
					commRegInternalId = commRegUpdateTnCAgreedDateSearchResult.getValue({
						name: "internalId"
					});
				});

			if (!isNullorEmpty(commRegInternalId)) {
				var commRegRecord = record.load({
					type: "customrecord_commencement_register",
					id: commRegInternalId,
					isDynamic: true
				});

				var scfLink = commRegRecord.getValue({
					fieldId: "custrecord_dynamic_scf_url"
				});

				var emailSubjectToLPOZee = "New Scheduled Customer - " + business_name;

				var emailToLPOBody =
					"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}</style></head>";
				var year = new Date().getFullYear();
				//Send out SCF to LPO & Zee to show the scheduled service for the customer that the LPO is paying.

				emailToLPOBody +=
					'<body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">New Scheduled Customer</div><p>Hello ' +
					lpoContactFirstName +
					",</p><p>The pickup you booked for " +
					business_name +
					" has been accepted by the courier team and is now active in your schedule.</p>";
				//Job Details Section

				var serviceTextInEmail = "";
				if (leadSelectedServiceText == "AMPO") {
					serviceTextInEmail = "LPO - TO - SITE";
				} else if (leadSelectedServiceText == "PMPO") {
					serviceTextInEmail = "SITE - TO - LPO";
				} else if (leadSelectedServiceText == "Package: AMPO & PMPO") {
					serviceTextInEmail = "Round Trip";
				}
				var prettyDate = formatDateToLongReadable(leadServiceDate);
				emailToLPOBody +=
					'<div class="job-details"><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
					serviceTextInEmail +
					'</span></div><div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">' +
					prettyDate +
					"</span></div>";
				if (!isNullorEmpty(freqArray)) {
					emailToLPOBody +=
						'<div class="detail-row"><span class="detail-label">Frequency:</span><span class="detail-value">' +
						freqArray +
						"</span></div>";
				}

				emailBody += "</div>";

				emailToLPOBody +=
					'<div class="detail-row"><span class="detail-label">SCF Link:</span><span class="detail-value"><a href="' +
					scfLink +
					'" target="_blank">Click Here</a></span></div>';

				emailToLPOBody +=
					'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
					year +
					" lpo.plus. All rights reserved.</p></div></div></body></html>";

				var sendOutEmailJSON = {
					to: [parentLPOEmail, zeeEmail],
					cc: [
						"michael.mcdaid@mailplus.com.au",
						"kerry.oneill@mailplus.com.au"
					],
					subject: emailSubjectToLPOZee,
					html: emailToLPOBody,
					metadata: {
						lpoId: lpoParentId,
						customerId: customerInternalId,
						jobId: lpoPlusJobId
					}
				};
				var firebaseUpdateURL =
					"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

				var apiHeaders = {};
				apiHeaders["Content-Type"] = "application/json";
				apiHeaders["x-api-key"] =
					"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
				//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

				var responseSendSCF = https.request({
					method: https.Method.POST,
					url: firebaseUpdateURL,
					body: JSON.stringify(sendOutEmailJSON),
					headers: apiHeaders
				});

				var myresponseSendSCF_body = responseSendSCF.body;
				var myresponseSendSCF_code = responseSendSCF.code;

				log.debug({
					title: "myresponseSendSCF_body",
					details: myresponseSendSCF_body
				});

				log.debug({
					title: "myresponseSendSCF_code",
					details: myresponseSendSCF_code
				});

				var returnObj = {
					success: true,
					message: "SCF Link sent successfully",
					customerInternalId: customerInternalId,
					result: ""
				};
			} else {
				var returnObj = {
					success: false,
					message:
						"No Commencement Register record found for the given customer",
					customerInternalId: customerInternalId,
					result: ""
				};
			}

			log.debug({
				title: "returnObj",
				details: returnObj
			});

			_sendJSResponse(context.request, context.response, returnObj);
		} else {
		}
	}

	/**
	 * @description Check if a suburb, state, and postcode combination exists in a JSON array.
	 * @author Ankith Ravindran (AR)
	 * @date 28/09/2025
	 * @param {*} jsonArray
	 * @param {*} suburb
	 * @param {*} state
	 * @param {*} postcode
	 * @returns {*}
	 */
	function suburbStatePostcodeExists(jsonArray, suburb, state, postcode) {
		log.audit({
			title: "suburbStatePostcodeExists",
			details: {
				suburb: suburb,
				state: state,
				postcode: postcode,
				jsonArray: jsonArray
			}
		});
		for (var i = 0; i < jsonArray.length; i++) {
			if (
				jsonArray[i].suburbs === suburb.toUpperCase() &&
				jsonArray[i].state === state &&
				jsonArray[i].post_code === postcode
			) {
				return true;
			}
		}
		return false;
	}

	function getDate() {
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

	function _sendJSResponse(request, response, respObject) {
		// response.setContentType("JAVASCRIPT");
		response.setHeader("Access-Control-Allow-Origin", "*");
		var callbackFcn = request.jsoncallback || request.callback;
		if (callbackFcn) {
			response.writeLine({
				output: callbackFcn + "(" + JSON.stringify(respObject) + ");"
			});
		} else response.writeLine({ output: JSON.stringify(respObject) });
	}

	function removeDuplicates(arr) {
		var unique = [];
		for (var i = 0; i < arr.length; i++) {
			if (unique.indexOf(arr[i]) === -1) {
				unique.push(arr[i]);
			}
		}
		return unique;
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
			if (
				serviceList[i].name.trim().toLowerCase() ==
				serviceName.trim().toLowerCase()
			) {
				return { rate: serviceList[i].rate, id: serviceList[i].id };
			}
		}
		return null; // Not found
	}

	function generateEncryptedUrl(
		lpoLeadParentLPOCustomerId,
		lpoParentLPOSubCustomerforAdhocBookingInternalId
	) {
		const url =
			"https://1048144.app.netsuite.com/app/site/hosting/scriptlet.nl?script=2129&deploy=1";
		const plainText = JSON.stringify({
			lpoparentid: lpoLeadParentLPOCustomerId,
			lposubcustomer: lpoParentLPOSubCustomerforAdhocBookingInternalId
		}); // The idea here is to put comm reg id in the url but encrypted so that we don't expose our internal ids
		var secretKey = getSecretKey();

		log.audit({
			title: "secretKey",
			details: secretKey
		});

		var encrypted = encryptURL(plainText, secretKey);

		return url + "&ct=" + encrypted.ciphertext + "&iv=" + encrypted.iv; // the final encrypted url containing the cipher text and the iv
	}

	function getSecretKey() {
		var secret = "custsecret_lpo_job_booking_page";
		return crypto.createSecretKey({
			encoding: encode.Encoding.UTF_8,
			secret: secret // ID of the secret from the Secrets Management
		});
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

	function encryptURL(plainText, secretKey) {
		var cipher = crypto.createCipher({
			algorithm: crypto.EncryptionAlg.AES, // AES-CBC, PKCS5 padding by default
			padding: crypto.Padding.PKCS5Padding, // already the default, put it here for clarity
			key: secretKey
		});

		cipher.update({
			input: plainText,
			inputEncoding: encode.Encoding.UTF_8
		});

		return cipher.final({ outputEncoding: encode.Encoding.BASE_64_URL_SAFE });
	}

	function isNullorEmpty(strVal) {
		return (
			strVal == null ||
			strVal == "" ||
			strVal == "null" ||
			strVal == undefined ||
			strVal == "undefined" ||
			strVal == "- None -" ||
			strVal == "0"
		);
	}

	function getDateToday() {
		var date = new Date();
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

	return {
		onRequest: onRequest
	};
});
