/** 
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 
 * Author:               Ankith Ravindran
 * Created on:           Wed Jan 21 2026
 * Modified on:          Wed Jan 21 2026 11:46:13
 * SuiteScript Version:  2.0 
 * Description:          Suitelet API to resync Lead to ProspectPlus Firebase. 
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */

define([
	"N/task",
	"N/email",
	"N/runtime",
	"N/search",
	"N/record",
	"N/format",
	"N/https"
], function (task, email, runtime, search, record, format, https) {
	var main_JSON = "";

	function onRequest(context) {
		if (context.request.method === "GET") {
			var todayDate = new Date();
			var yesterdayDate = new Date(todayDate);

			log.audit({
				title: "todayDate",
				details: todayDate
			});

			// dialers.forEach(function (d) { dialerCounts[d] = 0; });

			//GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
			var tokenBody =
				'{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";

			var responseAccessToken = https.request({
				method: https.Method.POST,
				url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs",
				headers: apiHeaders,
				body: tokenBody
			});

			log.debug({
				title: "Firebase Access Token Response",
				details: responseAccessToken.body
			});

			var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

			var idToken = responseAccessTokenObj.idToken;
			// idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
			var refreshToken = responseAccessTokenObj.refreshToken;

			log.audit({
				title: "context.request.parameters",
				details: context.request.parameters
			});

			var customerInternalId = context.request.parameters.customerInternalId;

			//Load Customer Record
			var customer_record = record.load({
				type: record.Type.LEAD,
				id: customerInternalId
			});

			//Billing Type
			var billingType = customer_record.getValue({
				fieldId: "custentity_lpo_invoice_payment"
			});

			var customerEntityId = customer_record.getValue({
				fieldId: "entityid"
			});

			//Get Parent Account of Subcustomer linked to MP
			var parentAccountInternalId = customer_record.getValue({
				fieldId: "parent"
			});

			var parentCustomerRecord = record.load({
				type: record.Type.LEAD,
				id: parentAccountInternalId
			});

			var lpoLinkedZees = parentCustomerRecord.getValue({
				fieldId: "custentity_lpo_linked_franchisees"
			});
			var parentLPOInternalId = parentCustomerRecord.getValue({
				fieldId: "parent"
			});

			var lpoLinkedZeesArray = [];
			if (!isNullorEmpty(lpoLinkedZees)) {
				lpoLinkedZees = lpoLinkedZees.toString();
				log.debug({
					title: "lpoLinkedZees",
					details: lpoLinkedZees
				});
				if (lpoLinkedZees.indexOf(",") != -1) {
					lpoLinkedZeesArray = lpoLinkedZees.split(",");
				} else {
					lpoLinkedZeesArray = [];
					lpoLinkedZeesArray.push(lpoLinkedZees);
				}
			}
			log.debug({
				title: "lpoLinkedZeesArray",
				details: lpoLinkedZeesArray
			});

			// var linkedZeeDetails = '"linkedZeeDetails": {"arrayValue": { "values": [';

			for (var lllz = 0; lllz < lpoLinkedZeesArray.length; lllz++) {
				var customerPartnerRecord = record.load({
					type: "partner",
					id: lpoLinkedZeesArray[lllz]
				});

				var mainContactName = customerPartnerRecord.getValue({
					fieldId: "custentity3"
				});
				var partnerPhone = customerPartnerRecord.getValue({
					fieldId: "custentity2"
				});
				var partnerEmail = customerPartnerRecord.getValue({
					fieldId: "email"
				});

				partnerPhone = partnerPhone.replace(/ /g, "");
				partnerPhone = partnerPhone.slice(1);
				partnerPhone = "+61" + partnerPhone;

				// var stringValue =
				// 	mainContactName + "," + partnerEmail + "," + partnerPhone;
				// linkedZeeDetails += '{"stringValue": "' + stringValue + '"},';
			}
			//remove thee last character if it is a comma
			// if (linkedZeeDetails.slice(-1) == ",") {
			// 	linkedZeeDetails = linkedZeeDetails.slice(0, -1);
			// }
			// linkedZeeDetails += "]}}";

			log.audit({
				title: "Linked Zee Details",
				details: linkedZeeDetails
			});

			//Get Contact Details
			// NetSuite Search: SALESP - Contacts
			var searched_contacts = search.load({
				id: "customsearch_salesp_contacts",
				type: "contact"
			});

			searched_contacts.filters.push(
				search.createFilter({
					name: "internalid",
					join: "CUSTOMER",
					operator: search.Operator.ANYOF,
					values: parseInt(customerInternalId)
				})
			);
			resultSetContacts = searched_contacts.run();

			var serviceContactResult = resultSetContacts.getRange({
				start: 0,
				end: 1
			});

			var primaryContactInternalID = "";
			var customerContactFirstName = "";
			var customerContactLastName = "";
			var customerContactEmail = "";
			var customerContactPhone = "";
			if (serviceContactResult.length == 1) {
				primaryContactInternalID = serviceContactResult[0].getValue({
					name: "internalid"
				});
				lpoContactFName = serviceContactResult[0].getValue({
					name: "firstname"
				});
				lpoContactLName = serviceContactResult[0].getValue({
					name: "lastname"
				});
				lpoContactEmail = serviceContactResult[0].getValue({
					name: "email"
				});
				lpoContactPhone = serviceContactResult[0].getValue({
					name: "phone"
				});
			}

			//Get the Address of the LPO Customer
			//NetSuite Search: SALESP - Addresses
			var searched_addresses = search.load({
				id: "customsearch_cust_list_site_addresses",
				type: "customer"
			});

			searched_addresses.filters.push(
				search.createFilter({
					name: "internalid",
					operator: search.Operator.ANYOF,
					values: customerInternalId
				})
			);

			var address1 = "";
			var address2 = "";
			var suburb = "";
			var state = "";
			var postcode = "";
			var latitude = "";
			var longitude = "";

			searched_addresses.run().each(function (resultSetAddresses) {
				address2 = resultSetAddresses.getValue({
					name: "address1",
					join: "Address"
				});
				address1 = resultSetAddresses.getValue({
					name: "address2",
					join: "Address"
				});
				suburb = resultSetAddresses.getValue({
					name: "city",
					join: "Address"
				});
				state = resultSetAddresses.getText({
					name: "state",
					join: "Address"
				});
				postcode = resultSetAddresses.getValue({
					name: "zipcode",
					join: "Address"
				});
				latitude = resultSetAddresses.getValue({
					name: "custrecord_address_lat",
					join: "Address"
				});
				longitude = resultSetAddresses.getValue({
					name: "custrecord_address_lon",
					join: "Address"
				});
				return true;
			});

			var lpoSubCustomerListSearch = search.load({
				type: "customer",
				id: "customsearch_lpo_sub_customer_list"
			});

			lpoSubCustomerListSearch.filters.push(
				search.createFilter({
					name: "internalid",
					join: null,
					operator: search.Operator.ANYOF,
					values: customerInternalId
				})
			);
			// lpoSubCustomerListSearch.filters.push(
			// 	search.createFilter({
			// 		name: "partner",
			// 		join: null,
			// 		operator: search.Operator.ANYOF,
			// 		values: lpoLinkedZeesArray
			// 	})
			// );

			var countServiceList = 0;
			var serviceList = [];
			var oldLPOSubCustomerInternalId = 0;
			var lpoSubCustomerServiceToBeCreatedInternalID = 0;

			lpoSubCustomerListSearch.run().each(function (resultSet) {
				var lpoSubCustomerInternalID = resultSet.getValue({
					name: "internalid"
				});

				var service = {
					id: resultSet.getValue({
						name: "internalid",
						join: "CUSTRECORD_SERVICE_CUSTOMER"
					}),
					name: resultSet.getValue({
						name: "name",
						join: "CUSTRECORD_SERVICE_CUSTOMER"
					}),
					rate: resultSet.getValue({
						name: "custrecord_service_price",
						join: "CUSTRECORD_SERVICE_CUSTOMER"
					})
				};
				serviceList.push(service);
				if (
					oldLPOSubCustomerInternalId != 0 &&
					oldLPOSubCustomerInternalId != lpoSubCustomerInternalID
				) {
					lpoSubCustomerServiceToBeCreatedInternalID =
						oldLPOSubCustomerInternalId;
					return false; //Stop the loop if we have already processed the sub customer
				}

				oldLPOSubCustomerInternalId = lpoSubCustomerInternalID;
				countServiceList++;
				return true;
			});

			if (countServiceList > 0) {
				lpoSubCustomerServiceToBeCreatedInternalID =
					oldLPOSubCustomerInternalId;
			}

			log.debug({
				title: "lpoSubCustomerServiceToBeCreatedInternalID",
				details: lpoSubCustomerServiceToBeCreatedInternalID
			});
			log.debug({
				title: "serviceList",
				details: serviceList
			});

			if (billingType == "Full Payment LPO") {
				var serviceAMPO = { id: 0, rate: 0 };
				serviceAMPO = getServiceRate(serviceList, "AMPO");
				var servicePMPO = { id: 0, rate: 0 };
				servicePMPO = getServiceRate(serviceList, "PMPO");
				var serviceAMPOPMPO = { id: 0, rate: 0 };
				serviceAMPOPMPO = getServiceRate(serviceList, "Package: AMPO & PMPO");
			} else if (billingType == "Full Payment Customer") {
			}

			var serviceAdditonalLPOBag = { id: 0, rate: 0 };
			serviceAdditonalLPOBag = getServiceRate(
				serviceList,
				"Additional LPO Bag"
			);

			//Load Partner Record to get the AP Suburb Mapping JSON
			var activeOperator = [];
			var lpoSuburbMappingJSON = [];
			var finalZeeIDArray = [];
			var lpoLinkedZeeTextArray = [];
			var linkedZeeDetails = '"linkedZeeDetails": {"arrayValue": { "values": [';
			for (var x = 0; x < lpoLinkedZeesArray.length; x++) {
				var partnerRecord = record.load({
					type: record.Type.PARTNER,
					id: lpoLinkedZeesArray[x]
				});

				var zeeJSONString = partnerRecord.getValue({
					fieldId: "custentity_ap_suburbs_json"
				});
				var zeeName = partnerRecord.getValue({
					fieldId: "companyname"
				});

				var mainContactName = partnerRecord.getValue({
					fieldId: "custentity3"
				});
				var partnerPhone = partnerRecord.getValue({
					fieldId: "custentity2"
				});
				var partnerEmail = partnerRecord.getValue({
					fieldId: "email"
				});

				partnerPhone = partnerPhone.replace(/ /g, "");
				partnerPhone = partnerPhone.slice(1);
				partnerPhone = "+61" + partnerPhone;

				var stringValue =
					mainContactName + "," + partnerEmail + "," + partnerPhone;

				log.audit({
					title: "zeeJSONString",
					details: zeeJSONString
				});

				var zeeJSON = JSON.parse(zeeJSONString);

				log.audit({
					title: "zeeJSON",
					details: zeeJSON
				});
				log.audit({
					title: "city",
					details: suburb
				});
				log.audit({
					title: "state",
					details: state
				});
				log.audit({
					title: "postcode",
					details: postcode
				});

				var suburbStatePostcodeExistsReturn = suburbStatePostcodeExists(
					zeeJSON,
					suburb,
					state,
					postcode
				);

				log.audit({
					title: "suburbStatePostcodeExistsReturn",
					details: suburbStatePostcodeExistsReturn
				});

				if (suburbStatePostcodeExistsReturn) {
					finalZeeIDArray.push(lpoLinkedZeesArray[x]);
					lpoLinkedZeeTextArray.push(zeeName);
					linkedZeeDetails += '{"stringValue": "' + stringValue + '"},';
					zeeJSON.forEach(function (suburb) {
						lpoSuburbMappingJSON.push(suburb);
						if (!isNullorEmpty(suburb.primary_op)) {
							if (Array.isArray(suburb.primary_op)) {
								for (var i = 0; i < suburb.primary_op.length; i++) {
									activeOperator.push(suburb.primary_op[i]);
								}
							} else {
								activeOperator.push(suburb.primary_op);
							}
						}
					});
				}

				log.audit({
					title: "activeOperator",
					details: activeOperator
				});
				log.audit({
					title: "finalZeeIDArray",
					details: finalZeeIDArray
				});
			}

			//remove thee last character if it is a comma
			if (linkedZeeDetails.slice(-1) == ",") {
				linkedZeeDetails = linkedZeeDetails.slice(0, -1);
			}
			linkedZeeDetails += "]}}";

			log.audit({
				title: "linkedZeeDetails",
				details: linkedZeeDetails
			});

			activeOperator = removeDuplicates(activeOperator);

			log.audit({
				title: "activeOperator",
				details: activeOperator
			});
			log.audit({
				title: "finalZeeIDArray",
				details: finalZeeIDArray
			});
			log.audit({
				title: "lpoLinkedZeeTextArray",
				details: lpoLinkedZeeTextArray
			});

			//Remove duplicates from lpoSuburbMappingJSON based on the suburb, state and postcode combination
			lpoSuburbMappingJSON =
				removeDuplicatesBySuburbStatePostcode(lpoSuburbMappingJSON);

			log.debug({
				title: "lpoSuburbMappingJSON",
				details: lpoSuburbMappingJSON
			});
			log.debug({
				title: "activeOperator",
				details: activeOperator
			});

			var customerDetails = '{"fields": {';

			customerDetails +=
				'"franchisee": {"stringValue": "' + finalZeeIDArray + '"},';
			customerDetails +=
				'"franchiseeText": {"stringValue": "' + lpoLinkedZeeTextArray + '"},';
			customerDetails +=
				'"franchiseeTerritoryJSON": {"arrayValue": { "values": [';
			lpoSuburbMappingJSON.forEach(function (suburb) {
				var stringValue =
					suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
				customerDetails += '{"stringValue": "' + stringValue + '"},';
			});
			//remove thee last character if it is a comma
			if (customerDetails.slice(-1) == ",") {
				customerDetails = customerDetails.slice(0, -1);
			}
			customerDetails += "]}},";

			// customerDetails +=
			// 	'"lpoServiceAdditionalBagInternalID": {"stringValue": "' +
			// 	serviceAdditonalLPOBag.id +
			// 	'"},';
			// customerDetails +=
			// 	'"lpoServiceAdditionalBagRate": {"stringValue": "' +
			// 	serviceAdditonalLPOBag.rate +
			// 	'"},';

			customerDetails += linkedZeeDetails;
			customerDetails += "}}";

			log.debug({
				title: "customerDetails",
				details: customerDetails
			});

			//{"fields": {"franchisee": {"stringValue": "425904,779884"},"franchiseeText": {"stringValue": "TEST - AR,TEST - NSW"},"franchiseeTerritoryJSON": {"arrayValue": { "values": [{"stringValue": "BEAUMONT HILLS, NSW 2155"},{"stringValue": "KELLYVILLE RIDGE, NSW 2155"},{"stringValue": "NORTH KELLYVILLE, NSW 2155"},{"stringValue": "KELLYVILLE, NSW 2155"},{"stringValue": "CASTLE HILL, NSW 2154"},{"stringValue": "KIRRAWEE, NSW 2232"},{"stringValue": "SUTHERLAND, NSW 2232"},{"stringValue": "SYDNEY, NSW 2000"},{"stringValue": "SCHOFIELDS, NSW 2762"}]}},"linkedZeeDetails": {"arrayValue": { "values": [{"stringValue": "Ankith Ravindran,ankith.ravindran@mailplus.com.au,+61402712233"},{"stringValue": "Fiona Harrison,fiona.harrison@mailplus.com.au,+61423847850"}]}}}}

			var firebaseLeadURL =
				"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
				parentLPOInternalId +
				"/customers/" +
				customerInternalId;

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";
			apiHeaders["Accept"] = "*/*";
			apiHeaders["Authorization"] = "Bearer " + idToken;

			var responseLeadDocument = https.request({
				method: https.Method.GET,
				url: firebaseLeadURL,
				headers: apiHeaders
			});

			var dbBody = responseLeadDocument.body;

			log.audit({
				title: "Lead Firebase Data",
				details: dbBody
			});

			var responseObj = JSON.parse(dbBody);

			//Check if fields exist
			if (!isNullorEmpty(responseObj.fields)) {
				log.audit({
					title:
						"Lead " +
						customerInternalId +
						"exists in LPO" +
						parentLPOInternalId +
						" in Firebase and will be updated",
					details: ""
				});

				//Update Lead Record in Firebase
				var firebaseUpdateLeadsURL =
					"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
					parentLPOInternalId +
					"/customers/" +
					customerInternalId +
					"?updateMask.fieldPaths=franchisee&updateMask.fieldPaths=franchiseeText&updateMask.fieldPaths=franchiseeTerritoryJSON&updateMask.fieldPaths=linkedZeeDetails";

				log.debug({
					title: "firebaseUpdateLeadsURL",
					details: firebaseUpdateLeadsURL
				});

				var apiHeaders = {};
				apiHeaders["Content-Type"] = "application/json";
				apiHeaders["Accept"] = "*/*";
				apiHeaders["X-HTTP-Method-Override"] = "PATCH";

				var response = https.request({
					method: https.Method.POST,
					url: firebaseUpdateLeadsURL,
					body: customerDetails,
					headers: apiHeaders
				});

				var myresponse_body = response.body;
				var myresponse_code = response.code;

				log.debug({
					title: "myresponse_body",
					details: myresponse_body
				});

				log.debug({
					title: "myresponse_code",
					details: myresponse_code
				});

				var returnObj = {
					success: true,
					message: "",
					result: "Lead Resynced to Firebase Successfully"
				};

				log.audit({
					title:
						"Lead " + customerInternalId + " Resynced to Firebase Successfully",
					details: returnObj
				});
			} else {
				log.audit({
					title: "Lead " + internalid + " Record Does Not Exist in Firebase",
					details: ""
				});

				var returnObj = {
					success: false,
					message: "",
					result: "Lead Does Not Exist in Firebase"
				};
			}

			_sendJSResponse(context.request, context.response, returnObj);
		} else {
		}
	}

	return {
		onRequest: onRequest
	};

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

	function getSalesRepWithMinCount(salesReps, salesRepCounts) {
		// Find the minimum count among all sales reps
		var minCount = null;
		for (var i = 0; i < salesReps.length; i++) {
			var count = salesRepCounts[salesReps[i]];
			if (minCount === null || count < minCount) {
				minCount = count;
			}
		}
		// Collect all sales reps with the minimum count
		var eligibleSalesReps = [];
		for (var i = 0; i < salesReps.length; i++) {
			if (salesRepCounts[salesReps[i]] === minCount) {
				eligibleSalesReps.push(salesReps[i]);
			}
		}
		return eligibleSalesReps;
	}

	function getDialersWithMinCount(dialers, dialerCounts) {
		// Find the minimum count among all dialers
		var minCount = null;
		for (var i = 0; i < dialers.length; i++) {
			var count = dialerCounts[dialers[i]];
			if (minCount === null || count < minCount) {
				minCount = count;
			}
		}
		// Collect all dialers with the minimum count
		var eligibleDialers = [];
		for (var i = 0; i < dialers.length; i++) {
			if (dialerCounts[dialers[i]] === minCount) {
				eligibleDialers.push(dialers[i]);
			}
		}
		return eligibleDialers;
	}

	function getDateStoreNS() {
		var date = new Date();
		// if (date.getHours() > 6) {
		//     date.setDate(date.getDate() + 1);
		// }

		format.format({
			value: date,
			type: format.Type.DATE,
			timezone: format.Timezone.AUSTRALIA_SYDNEY
		});

		return date;
	}

	// Shuffle dialers for initial randomness
	function shuffle(array) {
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
	}

	/**
	 * @description Pads the current string with another string (multiple times, if needed) until the resulting string reaches the given length. The padding is applied from the start (left) of the current string.
	 * @param {string} str - The original string to pad.
	 * @param {number} targetLength - The length of the resulting string once the current string has been padded.
	 * @param {string} padString - The string to pad the current string with. Defaults to a space if not provided.
	 * @returns {string} The padded string.
	 */
	function customPadStart(str, targetLength, padString) {
		// Convert the input to a string
		str = String(str);

		// If the target length is less than or equal to the string's length, return the original string
		if (str.length >= targetLength) {
			return str;
		}

		// Calculate the length of the padding needed
		var paddingLength = targetLength - str.length;

		// Repeat the padString enough times to cover the padding length
		var repeatedPadString = customRepeat(
			padString,
			Math.ceil(paddingLength / padString.length)
		);

		// Slice the repeated padString to the exact padding length needed and concatenate with the original string
		return repeatedPadString.slice(0, paddingLength) + str;
	}

	/**
	 * @description Repeats the given string a specified number of times.
	 * @param {string} str - The string to repeat.
	 * @param {number} count - The number of times to repeat the string.
	 * @returns {string} The repeated string.
	 */
	function customRepeat(str, count) {
		// Convert the input to a string
		str = String(str);

		// If the count is 0 or less, return an empty string
		if (count <= 0) {
			return "";
		}

		// Initialize the result string
		var result = "";

		// Repeat the string by concatenating it to the result
		for (var i = 0; i < count; i++) {
			result += str;
		}

		return result;
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
			if (serviceList[i].name == serviceName) {
				return { rate: serviceList[i].rate, id: serviceList[i].id };
			}
		}
		return null; // Not found
	}

	function removeDuplicatesBySuburbStatePostcode(lpoSuburbMappingJSON) {
		var seen = {};
		var result = [];
		for (var i = 0; i < lpoSuburbMappingJSON.length; i++) {
			var item = lpoSuburbMappingJSON[i];
			var key = item.suburbs + "|" + item.state + "|" + item.post_code;
			if (!seen[key]) {
				seen[key] = true;
				result.push(item);
			}
		}
		return result;
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

	/**
	 * Is Null or Empty.
	 *
	 * @param {Object} strVal
	 */
	function isNullorEmpty(strVal) {
		return (
			strVal == null ||
			strVal == "" ||
			strVal == "null" ||
			strVal == undefined ||
			strVal == "undefined" ||
			strVal == "- None -"
		);
	}
});
