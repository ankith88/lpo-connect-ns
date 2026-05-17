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

			var internalid = context.request.parameters.customerInternalId;

			//Load Parent LPO Record
			var customer_record = record.load({
				type: record.Type.LEAD,
				id: internalid
			});

			var customerEntityId = customer_record.getValue({
				fieldId: "entityid"
			});
			var lpoName = customer_record.getValue({
				fieldId: "companyname"
			});
			var lpoLinkedZeesText = customer_record.getText({
				fieldId: "custentity_lpo_linked_franchisees"
			});
			var lpoLinkedZees = customer_record.getValue({
				fieldId: "custentity_lpo_linked_franchisees"
			});
			var lpoNameArray = lpoName.split(" - ");
			lpoName = lpoNameArray[0].trim();

			if (!isNullorEmpty(lpoLinkedZees)) {
				lpoLinkedZees = lpoLinkedZees.toString();
				log.debug({
					title: "lpoLinkedZees",
					details: lpoLinkedZees
				});
				if (lpoLinkedZees.indexOf(",") != -1) {
					var lpoLinkedZeesArray = lpoLinkedZees.split(",");
				} else {
					var lpoLinkedZeesArray = [];
					lpoLinkedZeesArray.push(lpoLinkedZees);
				}
			}
			log.debug({
				title: "lpoLinkedZeesArray",
				details: lpoLinkedZeesArray
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
					values: parseInt(internalid)
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
					values: internalid
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
					join: "parentcustomer",
					operator: search.Operator.ANYOF,
					values: internalid
				})
			);
			lpoSubCustomerListSearch.filters.push(
				search.createFilter({
					name: "partner",
					join: null,
					operator: search.Operator.ANYOF,
					values: lpoLinkedZeesArray
				})
			);

			var serviceList = [];
			var countServiceList = 0;
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

			//Load Partner Record to get the AP Suburb Mapping JSON
			var lpoSuburbMappingJSON = [];
			var activeOperator = [];

			for (var x = 0; x < lpoLinkedZeesArray.length; x++) {
				var partnerRecord = record.load({
					type: record.Type.PARTNER,
					id: lpoLinkedZeesArray[x]
				});

				var zeeJSONString = partnerRecord.getValue({
					fieldId: "custentity_ap_suburbs_json"
				});
				var zeeLocation = partnerRecord.getText({
					fieldId: "location"
				});

				var zeeJSON = JSON.parse(zeeJSONString);
				zeeJSON.forEach(function (suburb) {
					if (!isNullorEmpty(suburb.parent_lpo_id)) {
						if (suburb.parent_lpo_id == internalid) {
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
						}
					}
				});
			}

			log.debug({
				title: "activeOperator",
				details: activeOperator
			});

			activeOperator = removeDuplicates(activeOperator);

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

			var lpoDetails = '{"fields": {';
			lpoDetails += '"lpo_id": {"stringValue": "' + internalid + '"},';
			lpoDetails += '"name": {"stringValue": "' + lpoName + '"},';
			lpoDetails += '"address1": {"stringValue": "' + address1 + '"},';
			lpoDetails += '"street": {"stringValue": "' + address2 + '"},';
			lpoDetails += '"city": {"stringValue": "' + suburb + '"},';
			lpoDetails += '"Location": {"stringValue": "' + suburb + '"},';
			lpoDetails += '"state": {"stringValue": "' + state + '"},';
			lpoDetails += '"zip": {"stringValue": "' + postcode + '"},';
			lpoDetails += '"latitude": {"stringValue": "' + latitude + '"},';
			lpoDetails += '"longitude": {"stringValue": "' + longitude + '"},';
			lpoDetails += '"franchiseeTerritoryJSON": {"arrayValue": { "values": [';
			lpoSuburbMappingJSON.forEach(function (suburb) {
				var stringValue =
					suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
				lpoDetails += '{"stringValue": "' + stringValue + '"},';
			});
			//remove thee last character if it is a comma
			if (lpoDetails.slice(-1) == ",") {
				lpoDetails = lpoDetails.slice(0, -1);
			}
			lpoDetails += "]}},";

			//Service Rates
			if (getServiceRate(serviceList, "PMPO") != null) {
				var servicePMPO = getServiceRate(serviceList, "PMPO");
				lpoDetails +=
					'"lpoServicePMPOInternalID": {"stringValue": "' +
					servicePMPO.id +
					'"},';
				lpoDetails +=
					'"lpoServicePMPORate": {"stringValue": "' + servicePMPO.rate + '"},';
			}
			if (getServiceRate(serviceList, "AMPO") != null) {
				var serviceAMPO = getServiceRate(serviceList, "AMPO");
				lpoDetails +=
					'"lpoServiceAMPOInternalID": {"stringValue": "' +
					serviceAMPO.id +
					'"},';
				lpoDetails +=
					'"lpoServiceAMPORate": {"stringValue": "' + serviceAMPO.rate + '"},';
			}
			if (getServiceRate(serviceList, "Package: AMPO & PMPO") != null) {
				var serviceAMPOPMPO = getServiceRate(
					serviceList,
					"Package: AMPO & PMPO"
				);
				lpoDetails +=
					'"lpoServiceAMPOPMPOInternalID": {"stringValue": "' +
					serviceAMPOPMPO.id +
					'"},';
				lpoDetails +=
					'"lpoServiceAMPOPMPORate": {"stringValue": "' +
					serviceAMPOPMPO.rate +
					'"},';
			}
			if (getServiceRate(serviceList, "Additional LPO Bag") != null) {
				var serviceAdditionalLPOBag = getServiceRate(
					serviceList,
					"Additional LPO Bag"
				);
				lpoDetails +=
					'"lpoServiceAdditionalLPOBagInternalID": {"stringValue": "' +
					serviceAdditionalLPOBag.id +
					'"},';
				lpoDetails +=
					'"lpoServiceAdditionalLPOBagRate": {"stringValue": "' +
					serviceAdditionalLPOBag.rate +
					'"},';
			}
			//remove thee last character if it is a comma
			if (lpoDetails.slice(-1) == ",") {
				lpoDetails = lpoDetails.slice(0, -1);
			}
			lpoDetails += "}}";

			log.debug({
				title: "LPO Details",
				details: lpoDetails
			});

			var firebaseLeadURL =
				"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
				internalid;

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
						internalid +
						" Record Exists > Updating Record in Firebase",
					details: ""
				});

				//Update Lead Record in Firebase
				var firebaseUpdateLeadsURL =
					"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
					internalid +
					"?updateMask.fieldPaths=lpo_id&updateMask.fieldPaths=name&updateMask.fieldPaths=address1&updateMask.fieldPaths=street&updateMask.fieldPaths=city&updateMask.fieldPaths=state&updateMask.fieldPaths=zip&updateMask.fieldPaths=latitude&updateMask.fieldPaths=longitude&updateMask.fieldPaths=Location&updateMask.fieldPaths=franchiseeTerritoryJSON&updateMask.fieldPaths=lpoServicePMPOInternalID&updateMask.fieldPaths=lpoServicePMPORate&updateMask.fieldPaths=lpoServiceAMPOInternalID&updateMask.fieldPaths=lpoServiceAMPORate&updateMask.fieldPaths=lpoServiceAMPOPMPOInternalID&updateMask.fieldPaths=lpoServiceAMPOPMPORate&updateMask.fieldPaths=lpoServiceAdditionalLPOBagInternalID&updateMask.fieldPaths=lpoServiceAdditionalLPOBagRate";

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
					body: lpoDetails,
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
					title: "Lead " + internalid + " Resynced to Firebase Successfully",
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
