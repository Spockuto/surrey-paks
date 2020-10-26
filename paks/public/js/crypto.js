var q = ecc.sjcl.ecc.curves.c384.r;
var g = ecc.sjcl.ecc.curves.c384.G;
var h = new ecc.sjcl.ecc.point( 
		ecc.sjcl.ecc.curves.c384,
    	new ecc.sjcl.bn.prime.p384("0xe4f93e8f283d098b0707ccec9db5194d0d343242e13ca63a03f0572904313fd72bf8e01a00df32b59132193769486bae"),
    	new ecc.sjcl.bn.prime.p384("0xe987d92f49cfc2d9442f8b789b60e6849f36af19c3e620cd059c15753674adb77fbb3a2e5f3506980ede294706d29100")
);

var fileArray = [];

function Tag(key, string){
	var hmac = new ecc.sjcl.misc.hmac(ecc.sjcl.codec.hex.fromBits(key), ecc.sjcl.hash.sha256);
	return ecc.sjcl.codec.hex.fromBits(hmac.encrypt(string));
}

function Verify(key, string, encrypted) {
	var hmac = new ecc.sjcl.misc.hmac(ecc.sjcl.codec.hex.fromBits(key), ecc.sjcl.hash.sha256);
	if(String(ecc.sjcl.codec.hex.fromBits(hmac.encrypt(string))) == String(encrypted))
		return "True";
	else 
		return "False";	
}

function Point(string){
	return new ecc.sjcl.ecc.point( ecc.sjcl.ecc.curves.c384, 
		     new ecc.sjcl.bn.prime.p384(string.split(",")[0]),
		     new ecc.sjcl.bn.prime.p384(string.split(",")[1]));
}

function toHex(str) {
	var hex = '';
	for(var i=0;i<str.length;i++) {
		hex += ''+str.charCodeAt(i).toString(16);
	}
	return "0x" + hex;
}

function toStr(str) {
	var hex  = str.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
}

function convertStringToArrayBufferView(str) {
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes;
}

function appendArray(buffer1, buffer2) {
  var tmp = new Uint8Array(buffer1.length + buffer2.length);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.length);
  return tmp;

}

function toHexString(byteArray) {
	return Array.prototype.map.call(byteArray, function(byte) {
	  return ('0' + (byte & 0xFF).toString(16)).slice(-2);
	}).join('');
}

function toByteArray(hexString) {
	var result = [];
	for (var i = 0; i < hexString.length; i += 2) {
	  result.push(parseInt(hexString.substr(i, 2), 16));
	}
	return result;
}

/*
File Encryption requires three parameters
	file : The bit string
	password : key derived
	iv string : r_fid
*/

function encryptData(file, password, iv){
   	var encrypted_data = ""; 
	return crypto.subtle.digest(
   		{
   			name: "SHA-256"
   		}, 
   		convertStringToArrayBufferView(password)
   	)
   	.then(function(result){
		return window.crypto.subtle.importKey(
			"raw", 
			result, 
			{
				name: "AES-GCM"
			}, 
			false, 
			["encrypt", "decrypt"]
		)
		.then(function(key){
			return crypto.subtle.encrypt(
				{
					name: "AES-GCM", 
					iv: iv
				}, 
				key, 
				file
			)
			.then(function(result){
				encrypted_data = new Uint8Array(result);
				return encrypted_data;
			})
			.catch(function(e){
				console.log(e);
			});
    	})
    	.catch(function(e){
    		console.log(e);
    	});
    })
    .catch(function(e){
    	console.log(e);
    });
}

/*
File Decryption requires three parameters
	encrypted_data : The bit string
	password : key derived
	iv string : r_fid
*/

function decryptData(encrypted_data, password, iv){

	return crypto.subtle.digest(
   		{
   			name: "SHA-256"
   		}, 
   		convertStringToArrayBufferView(password)
   	)
   	.then(function(result){
		return window.crypto.subtle.importKey(
			"raw", 
			result, 
			{
				name: "AES-GCM"
			}, 
			false, 
			["encrypt", "decrypt"]
		)
		.then(function(key){
			return crypto.subtle.decrypt(
				{
					name: "AES-GCM", 
					iv: iv
				}, 
				key, 
				encrypted_data
			)
			.then(function(result){
				data = new Uint8Array(result);
				return data;
			})
			.catch(function(e){
				console.log(e);
			});
    	})
    	.catch(function(e){
    		console.log(e);
    	});
    })
    .catch(function(e){
    	console.log(e);
    });
}

function IV(email, ctr){
	return ecc.sjcl.hash.sha256.hash(email + String(ctr));
}

function encryptFile(email, name, key){
	var iv = new Uint8Array(12);
	window.crypto.getRandomValues(iv);
	var r_fid = iv.join();
	var kprime = ecc.sjcl.misc.pbkdf2(key.x.toLocaleString() + email + r_fid, r_fid);
	console.log(kprime);
	var kprime_hex = ecc.sjcl.codec.hex.fromBits(kprime);
	var name_buf = ecc.sjcl.codec.hex.toBits(toHex(name));
	var prp = new ecc.sjcl.cipher.aes(kprime);
	var encrypt_filename = ecc.sjcl.mode.gcm.encrypt(prp, name_buf, ecc.sjcl.hash.sha256.hash(r_fid));
	var ix = toHexString(iv) + ecc.sjcl.codec.hex.fromBits(encrypt_filename);
	console.log(ix);
	for(var i = 0; i < window.files.length; i++){
		if(window.files[i].name == name){
			readFile(window.files[i], ix, kprime_hex, iv);
		}
	}
	return ix;
}

function decryptFile(email, key, ix){
	key = Point(key);
	ix = ix.replace("file:" , "");
	console.log(email + " " + key +  " " + ix);
	var r_fid =  toByteArray(ix.slice(0,24)).join();
	var encrypt_filename = ix.slice(24,);
	var kprime = ecc.sjcl.misc.pbkdf2(key.x.toLocaleString() + email + r_fid, r_fid);
	//var kprime_hex = ecc.sjcl.codec.hex.fromBits(kprime);

	var enc_name_buf = ecc.sjcl.codec.hex.toBits(encrypt_filename);
	var prp = new ecc.sjcl.cipher.aes(kprime);
	var decrypt_filename = ecc.sjcl.mode.gcm.decrypt(prp, enc_name_buf, ecc.sjcl.hash.sha256.hash(r_fid));
	console.log(ecc.sjcl.codec.hex.fromBits(decrypt_filename));
	var name = toStr(ecc.sjcl.codec.hex.fromBits(decrypt_filename));
	return name;
}

function saveFile(file1, file2, filename, actual_filename, email, key){
	var t0 = performance.now();
	var decrypted_data = "";
	var file = new Uint8Array(file1.length);
	console.log(file1);
	console.log(file2);
	file1.forEach(function XORArrayElements(element, index, array) {
  		file[index] = file2[index] ^ element;
	});

	key = Point(key);
	var ix = filename.replace("file:" , "");
	console.log(email + " " + key +  " " + ix);
	var iv =  new Uint8Array(toByteArray(ix.slice(0,24)));
	console.log(iv);
	var r_fid = iv.join();

	var kprime = ecc.sjcl.misc.pbkdf2(key.x.toLocaleString() + email + r_fid, r_fid);
	var kprime_hex = ecc.sjcl.codec.hex.fromBits(kprime);

	decryptData(file, kprime_hex, iv)
	.then((dec) => {
		var time0 = performance.now() - t0;
        alert("Retrieve File Decryption Time" + time0);
        console.log("Retrieve File Decryption Time" + time0);
		decrypted_data = dec;
	})
	.then(function(){
		const blob = new Blob( [decrypted_data.buffer] , {type : 'application/octet-stream'});
		const objectURL = URL.createObjectURL( blob );
		link.href = objectURL ;
		link.download = actual_filename ;
		link.click()
	});
}

function change(data){
	var password = data.password;
	var gx0 = Point(data.server0.xd);
	var gx1 = Point(data.server1.xd);
	var r2 = new ecc.sjcl.bn.random(q, 10);
	var gr2 = g.mult(r2);
	var gx0gx1 = gx0.toJac().add(gx1).toAffine();
	var final = gx0gx1.mult2(r2, new ecc.sjcl.bn.prime.p384(toHex(password)), h);
	var result = new Object();
	result.gr2 = gr2.x.toLocaleString() + ',' + gr2.y.toLocaleString();
	result.cpi = final.x.toLocaleString() + ',' + final.y.toLocaleString();
	return result;
}

function register(password){

	//r1,r2,x0,x1 <- Zq*
	var r1 = new ecc.sjcl.bn.random(q, 10);
	var gr1 = g.mult(r1);
	var r2 = new ecc.sjcl.bn.random(q, 10);
	var gr2 = g.mult(r2);
	var x0 = new ecc.sjcl.bn.random(q, 10);
	var x1 = new ecc.sjcl.bn.random(q, 10);

	//k,k0 <- G
	var random = ecc.sjcl.random.randomWords(2,10);
	var k = g.mult(new ecc.sjcl.bn.prime.p384(random[0]));
	var k0 = g.mult(new ecc.sjcl.bn.prime.p384(random[1]));

	while(!k.isValid() || !k0.isValid()){
		random = ecc.sjcl.random.randomWords(2,10);
		k = g.mult(new ecc.sjcl.bn.prime.p384(random[0]));
		k0 = g.mult(new ecc.sjcl.bn.prime.p384(random[1]));
	}

	var x = g.mult(x0.add(x1));
	var xr1 = x.mult(r1);
	var k0Inverse = Point(k0.x.toLocaleString()  + "," + k0.y.mul(-1).toLocaleString());
	var k1 = xr1.toJac().add(k).add(k0Inverse).toAffine();
	var cpi = x.mult2(r2, new ecc.sjcl.bn.prime.p384(toHex(password)), h);

	//unsure about this part
	var mk0 = ecc.sjcl.misc.cachedPbkdf2(k.x.toLocaleString() + "server0" + "1");
	var mk1 = ecc.sjcl.misc.cachedPbkdf2(k.x.toLocaleString() + "server1" + "1");

	var result = new Object();
	result.x0 = x0.toLocaleString();
	result.x1 = x1.toLocaleString();
	result.gr1 = gr1.x.toLocaleString() + ',' + gr1.y.toLocaleString();
	result.gr2 = gr2.x.toLocaleString() + ',' + gr2.y.toLocaleString();
	result.cpi = cpi.x.toLocaleString() + ',' + cpi.y.toLocaleString();
	result.k0 = k0.x.toLocaleString() + ',' + k0.y.toLocaleString();
	result.k1 = k1.x.toLocaleString() + ',' + k1.y.toLocaleString();
	result.mk0 = ecc.sjcl.codec.hex.fromBits(mk0.key) + "," + ecc.sjcl.codec.hex.fromBits(mk0.salt);
	result.mk1 = ecc.sjcl.codec.hex.fromBits(mk1.key) + "," + ecc.sjcl.codec.hex.fromBits(mk1.salt);
	return result;
}

function states(password){
	var a = new ecc.sjcl.bn.random(q, 10);
	var A = g.mult2(a, new ecc.sjcl.bn.prime.p384(toHex(password)), h);
	var result = new Object();
	result.a = a.toLocaleString();
	result.A = A.x.toLocaleString() + ',' + A.y.toLocaleString();
	return result;
}



function outsourced(data){
	var t0 = performance.now();

	var e = new ecc.sjcl.bn.random(ecc.sjcl.ecc.curves.c256.r, 10);
	var Y = Point(data.server0.y);
	var Z0 = Point(data.server0.zd);
	var Z1 = Point(data.server1.zd);
	var myu0 = data.server0.myud;
	var myu1 = data.server1.myud;
	var A = Point(data.a);
	var words  = data.tag.split(',');
	var email = data.email;
	var ixs = data.data;

	var Ya = Y.mult(new ecc.sjcl.bn.prime.p384(data.smalla));
	var K = Z0.toJac().add(Z1).add(Ya).toAffine();
	var mk0 = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + "server0" + "1", ecc.sjcl.codec.hex.toBits(data.server0.salt));
	var mk1 = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + "server1" + "1", ecc.sjcl.codec.hex.toBits(data.server1.salt));
	if(Verify(mk0, A.x.toLocaleString()  + Y.x.toLocaleString() + Z0.x.toLocaleString(), myu0) == "True"){
		if(Verify(mk1, A.x.toLocaleString() + Y.x.toLocaleString() + Z1.x.toLocaleString(), myu1) == "True"){
			
			var t1 = performance.now();
			var finalresult =  new Object();
			finalresult.key = t1 - t0;
			finalresult.outsource = [];

			ixs.forEach(function(ixC){
				var t1 = performance.now();
				var ix = ixC;
				/*Addition for file Encryption*/
				if(ix.indexOf(email) == 0){
					var filename = ix.split(',')[1];
					ix = "file:" + encryptFile(email, filename, K);
					//Necessary evil to handle the fucking promises
					//Fucking tired of this shit.
					console.log(ix);
				}
				
				var mku = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + email + "0" , email);
				var sk0 = ecc.sjcl.misc.cachedPbkdf2(ecc.sjcl.codec.hex.fromBits(mk0) + A.x.toLocaleString() + Y.x.toLocaleString() + "2");
				var sk1 = ecc.sjcl.misc.cachedPbkdf2(ecc.sjcl.codec.hex.fromBits(mk1) + A.x.toLocaleString() + Y.x.toLocaleString() + "2");

				var cipherdata = []
				words.forEach(function(word){
					var t = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + word, word);
					var prp = new ecc.sjcl.cipher.aes(t);
					var ctr = Math.random();
					var v =  ecc.sjcl.codec.hex.fromBits(ecc.sjcl.mode.gcm.encrypt(prp, e.toBits(), IV(email, ctr))).substring(0,64);			
					var myuc = Tag(mku, e.toLocaleString() + v + ix);
					var C = e.toLocaleString() + "," + v + "," + myuc;
					var myusk0 = Tag(sk0.key, C + ix);
					var myusk1 = Tag(sk1.key, C + ix);

					var result =  new Object();
	 				result.myusk0 = myusk0;
					result.myusk1 = myusk1;
					result.c  = C;
					result.ctr = String(ctr); 
					cipherdata.push(result);
				});

				var t2 = performance.now();

				var result =  new Object();		
				result.salt0 = ecc.sjcl.codec.hex.fromBits(sk0.salt);
				result.salt1 = ecc.sjcl.codec.hex.fromBits(sk1.salt);
				result.ix = ix;
				result.data = cipherdata;
				result.outsource =  t2 - t1;
				finalresult.outsource.push(result);
			});
			return finalresult;
		}
		else{
			return {result : "Tag 1 Verify Failed"};
		}
	}
	else{
		return {result : "Tag 2 Verify Failed"};
	}
}

function retrieveState1(data){

	var t0 = performance.now();

	var e = new ecc.sjcl.bn.random(ecc.sjcl.ecc.curves.c256.r, 10);
	var Y = Point(data.server0.y);
	var Z0 = Point(data.server0.zd);
	var Z1 = Point(data.server1.zd);
	var myu0 = data.server0.myud;
	var myu1 = data.server1.myud;
	var A = Point(data.a);
	var words  = data.tag;
	var email = data.email;

	var Ya = Y.mult(new ecc.sjcl.bn.prime.p384(data.smalla));
	var K = Z0.toJac().add(Z1).add(Ya).toAffine();
	var mk0 = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + "server0" + "1", ecc.sjcl.codec.hex.toBits(data.server0.salt));
	var mk1 = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + "server1" + "1", ecc.sjcl.codec.hex.toBits(data.server1.salt));

	if(Verify(mk0, A.x.toLocaleString()  + Y.x.toLocaleString() + Z0.x.toLocaleString(), myu0) == "True"){
		if(Verify(mk1, A.x.toLocaleString() + Y.x.toLocaleString() + Z1.x.toLocaleString(), myu1) == "True"){
				
				var t1 = performance.now();
				var finalresult =  new Object();
				finalresult.key = t1 - t0;
				finalresult.retrieve = [];

				words.forEach(function(word){
					var t = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + word, word);
					var sk0 = ecc.sjcl.misc.cachedPbkdf2(ecc.sjcl.codec.hex.fromBits(mk0) + A.x.toLocaleString() + Y.x.toLocaleString() + "2");
					var sk1 = ecc.sjcl.misc.cachedPbkdf2(ecc.sjcl.codec.hex.fromBits(mk1) + A.x.toLocaleString() + Y.x.toLocaleString() + "2");
					var myusk0 = Tag(sk0.key, ecc.sjcl.codec.hex.fromBits(t));
					var myusk1 = Tag(sk1.key, ecc.sjcl.codec.hex.fromBits(t));

					var t2 = performance.now();

					var result =  new Object();
					result.t = ecc.sjcl.codec.hex.fromBits(t);
	 				result.myusk0 = myusk0;
					result.myusk1 = myusk1;
					result.salt0 = ecc.sjcl.codec.hex.fromBits(sk0.salt);
					result.salt1 = ecc.sjcl.codec.hex.fromBits(sk1.salt);
					result.k = K.x.toLocaleString() + "," + K.y.toLocaleString();
					result.retrieve =  t2 - t1;
					result.tag = word;
					finalresult.retrieve.push(result);
				});
				return finalresult;
		}
		else{
			return {result : "Tag 1 Verify Failed"};
		}
	}
	else{
		return {result : "Tag 2 Verify Failed"};
	}

}

function retrieveState2(data){	
	var server0 = data.server0;
	var server1 = data.server1;
	var K = Point(data.k);
	var t = data.t;

	var mku = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + data.email + "0" , data.email);
	var result = {};
	var prp, C, v;

	server0.forEach(function(index){
		C = index.c.split(",");
		prp = new ecc.sjcl.cipher.aes(ecc.sjcl.codec.hex.toBits(t));
		v =  ecc.sjcl.codec.hex.fromBits(ecc.sjcl.mode.gcm.encrypt(prp, ecc.sjcl.codec.hex.toBits(C[0]), IV(data.email, index.ctr))).substring(0,64);

		if(v == C[1] && Verify(mku, C[0] + v + index.ix, C[2]) == "True" ){
			if(result[C[2]]){	
				result[C[2]]+=index.ix;
			}
			else{
				result[C[2]] = index.ix;
			}
		}
	});

	server1.forEach(function(index){
		C = index.c.split(",");
		prp = new ecc.sjcl.cipher.aes(ecc.sjcl.codec.hex.toBits(t));
		v =  ecc.sjcl.codec.hex.fromBits(ecc.sjcl.mode.gcm.encrypt(prp, ecc.sjcl.codec.hex.toBits(C[0]), IV(data.email, index.ctr))).substring(0,64);

		if(v == C[1] && Verify(mku, C[0] + v + index.ix, C[2]) == "True" ){
			if(!result[C[2]]){	
				result[C[2]] = index.ix;			
			}
		}
	});
	console.log("This is the result data");
	console.log(result); 
	return result;
}

function reset(data){
	var Y = Point(data.server0.y);
	var cpi = Point(data.server0.cpi);
	var gr2 = Point(data.server0.gr2);

	var Z0 = Point(data.server0.zd);
	var Z1 = Point(data.server1.zd);
	var myu0 = data.server0.myud;
	var myu1 = data.server1.myud;
	var email = data.email;
	var oldpassword = data.oldpassword;
	var newpassword = data.newpassword;

	var Ya = Y.mult(new ecc.sjcl.bn.prime.p384(data.smalla));
	var K = Z0.toJac().add(Z1).add(Ya).toAffine();
	var mk0 = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + "server0" + "1", ecc.sjcl.codec.hex.toBits(data.server0.salt));
	var mk1 = ecc.sjcl.misc.pbkdf2(K.x.toLocaleString() + "server1" + "1", ecc.sjcl.codec.hex.toBits(data.server1.salt));

	if(Verify(mk0, Y.x.toLocaleString() + Z0.x.toLocaleString() + gr2.x.toLocaleString() + cpi.x.toLocaleString(), myu0) == "True"){
		if(Verify(mk1, Y.x.toLocaleString() + Z1.x.toLocaleString()+ gr2.x.toLocaleString() + cpi.x.toLocaleString(), myu1) == "True"){
			var rstar = new ecc.sjcl.bn.random(q, 10);
			var hInverse =  Point(h.x.toLocaleString()  + "," + h.y.mul(-1).toLocaleString());
			var hInversePI = hInverse.mult(new ecc.sjcl.bn.prime.p384(toHex(oldpassword)));
			var cpihInversePI = hInversePI.toJac().add(cpi).toAffine();
			var cpistar = cpihInversePI.mult2(rstar, new ecc.sjcl.bn.prime.p384(toHex(newpassword)), h);
			var gr2star = gr2.mult(rstar);
			var myu0 = Tag(mk0, gr2star.x.toLocaleString() + cpistar.x.toLocaleString());
			var myu1 = Tag(mk1, gr2star.x.toLocaleString() + cpistar.x.toLocaleString());
			var result =  new Object();
 			result.myu0 = myu0;
			result.myu1 = myu1;
			result.cpi = cpistar.x.toLocaleString() + "," + cpistar.y.toLocaleString();
			result.gr2 = gr2star.x.toLocaleString() + "," + gr2star.y.toLocaleString();
			return result;
		}
		else{
			return {result : "Tag 1 Verify Failed"};
		}
	}
	else{
		return {result : "Tag 2 Verify Failed"};
	}
}

function readFile(file, encrypt_filename, kprime, iv){
	var reader = new FileReader();
   	reader.onload = function(e) {
    	data = reader.result;
    	var tempFiles = new Object();
		var t0 =  performance.now();
    	encryptData(data, kprime, iv)
    	.then((enc) => {
			var ofet = performance.now() - t0;
			alert("Outsource File Encryption Time " + ofet);
			console.log("Outsource File Encryption Time " + ofet);
    		tempFiles.data = enc;
    	})
    	.then(function(){
			var t1 =  performance.now();
         	tempFiles.name = encrypt_filename;
         	tempFiles.size = tempFiles.data.length;
         	if (tempFiles.data.length <= 65536){
         		tempFiles.random = crypto.getRandomValues(new Uint8Array(tempFiles.data.length));
         	}
         	else {
         		var loop = Math.floor(tempFiles.data.length / 65536);
         		var rem = tempFiles.data.length % 65536;
         		tempFiles.random = new Uint8Array(tempFiles.data.length);
         		var i  = 0 ;
         		while ( i < loop ) {
         			tempFiles.random.set(crypto.getRandomValues(new Uint8Array(65536)) , i * 65536);
         			i++;
         		}
         		tempFiles.random.set(crypto.getRandomValues(new Uint8Array(rem)) , i * 65536);
         	}

         	tempFiles.random.forEach(function XORArrayElements(element, index, array) {
  					tempFiles.data[index] = tempFiles.data[index] ^ element;
			});

			fileArray.push(tempFiles);
			var ofst = performance.now() - t1;
			var ofest = performance.now() - t0;
			alert("Outsource File SecSharing Time " + ofst + " Outsource File Encryption + SecSharing Time" + ofest);
			console.log("Outsource File SecSharing Time" + ofst);
			console.log("Outsource File Encryption + SecSharing Time" + ofest);
         });         	
	};
	reader.readAsArrayBuffer(file);
}

