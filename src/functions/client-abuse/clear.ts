/**
 * Clear's the in-game console
*/
export function clear() {
	try {
		console.log(
			"<script>angular.element(document.getElementsByClassName('fa fa-trash ng-scope')[0].parentNode).scope().Console.clear()</script>"
		)
	} catch (e) {
		console.log(`Execution Error In Function: clear() on Tick ${Game.time}. Error: ${e}`);
	}
}
