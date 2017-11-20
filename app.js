//app.js
App({
	onLaunch: function () {
		//引入知晓云sdk
		require('./libs/BaaS/sdk-v1.1.1.js');
		// 初始化 SDK
		let clientID = '4ed348d6c042e471706b';
		wx.BaaS.init(clientID);
		wx.BaaS.login(false);
	},
	globalData: {
		userInfo: null,
		subscribeItemListTableID: 3347,
		subscribeCompanyTableID: 3404,
		qiniuyunPath: 'http://ozfusju3i.bkt.clouddn.com/jujuflow/'
	}
})